'use client';

/**
 * Everything the screens show for the current person, kept fresh, and every
 * change to it.
 *
 * Changes show at once and are rolled back if the server says no (an
 * optimistic write, as LifeOS does). Her limits carry a version: a change made
 * from an older copy than the server's comes back 409, and the phone takes the
 * server's limits and says so, rather than overwrite what someone else set.
 *
 * Fresh means: loaded on open, again whenever the app comes back to the
 * front, and every 20 s while it is showing - so a meal logged on one phone
 * shows on the other. A refresh never runs over a write still in flight.
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import * as api from '@/lib/api';
import { reloadIfOutdated } from '@/lib/build';
import { CATALOG, type Meal } from '@/lib/catalog';
import { contextFrom } from '@/lib/history';
import type { Context, Item, MealType, Rules } from '@/lib/rules';
import { useToast } from './Toast';

const POLL_MS = 20_000;

interface Data {
  state: api.AppState | null;
  error: string | null;
  /** Built-in and built meals together. */
  meals: Meal[];
  mealById: (id: string) => Meal | undefined;
  context: Context;
  now: Date;
  saved: ReadonlySet<string>;
  pantry: ReadonlySet<string>;
  refresh: () => Promise<void>;
  setSaved: (mealId: string, on: boolean) => void;
  setPantry: (foodId: string, on: boolean) => void;
  logMeal: (meal: Meal) => Promise<void>;
  saveRules: (changes: Partial<Rules>) => void;
  addMeal: (type: MealType, items: Item[]) => Promise<Meal | null>;
  deleteMeal: (id: string) => Promise<void>;
}

const DataContext = createContext<Data | null>(null);

export function useData(): Data {
  const data = useContext(DataContext);
  if (!data) throw new Error('useData outside DataProvider');
  return data;
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<api.AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const writes = useRef(0);
  // Latest state for handlers, so a rollback restores what was there, not a stale closure's copy.
  const latest = useRef<api.AppState | null>(null);
  useLayoutEffect(() => { latest.current = state; }, [state]);

  const refresh = useCallback(async () => {
    if (writes.current > 0) return;
    try {
      const { state: fresh, build } = await api.fetchState();
      if (reloadIfOutdated(build)) return;
      if (writes.current === 0) setState(fresh);
      setError(null);
      setNow(new Date());
    } catch (e) {
      setError(message(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first load
    refresh();
    const onShow = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(onShow, POLL_MS);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    window.addEventListener('pageshow', onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('pageshow', onShow);
    };
  }, [refresh]);

  /** Apply now, send, and put things back if the server refuses. */
  const optimistic = useCallback(async <T,>(apply: (s: api.AppState) => api.AppState, request: () => Promise<T>, failText?: string): Promise<{ ok: true; value: T } | { ok: false }> => {
    const before = latest.current;
    if (!before) return { ok: false };
    const next = apply(before);
    latest.current = next;
    setState(next);
    writes.current++;
    try {
      return { ok: true, value: await request() };
    } catch (e) {
      setState((s) => s && { ...s, ...restore(before, s, apply) });
      toast(failText ?? message(e));
      return { ok: false };
    } finally {
      writes.current--;
    }
  }, [toast]);

  const setSaved = useCallback((mealId: string, on: boolean) => {
    optimistic(
      (s) => ({ ...s, saved: on ? [...new Set([...s.saved, mealId])] : s.saved.filter((id) => id !== mealId) }),
      () => api.setSaved(mealId, on),
    ).then((r) => r.ok && toast(on ? 'Saved' : 'Removed from saved'));
  }, [optimistic, toast]);

  const setPantry = useCallback((foodId: string, on: boolean) => {
    optimistic(
      (s) => ({ ...s, pantry: on ? [...new Set([...s.pantry, foodId])] : s.pantry.filter((id) => id !== foodId) }),
      () => api.setPantry(foodId, on),
    );
  }, [optimistic]);

  const logMeal = useCallback(async (meal: Meal) => {
    const temp = { id: `pending-${Date.now()}`, mealId: meal.id, name: meal.name, type: meal.type, items: meal.items, eatenAt: new Date().toISOString() };
    const result = await optimistic(
      (s) => ({ ...s, log: [temp, ...s.log] }),
      () => api.logMeal(meal.id),
      'Could not log that. Try again.',
    );
    if (!result.ok) return;
    const entry = result.value;
    setState((s) => s && { ...s, log: s.log.map((e) => (e.id === temp.id ? entry : e)) });
    setNow(new Date());
    toast(`Logged ${meal.type === 'snack' ? 'a snack' : meal.type}.`, {
      label: 'Undo',
      run: () => {
        optimistic((s) => ({ ...s, log: s.log.filter((e) => e.id !== entry.id) }), () => api.unlog(entry.id));
      },
    });
  }, [optimistic, toast]);

  const saveRules = useCallback((changes: Partial<Rules>) => {
    const before = latest.current;
    if (!before) return;
    setState({ ...before, rules: { ...before.rules, ...changes } });
    writes.current++;
    api.patchRules(changes, before.rulesUpdatedAt)
      .then((r) => setState((s) => s && { ...s, rules: r.rules, rulesUpdatedAt: r.rulesUpdatedAt }))
      .catch((e) => {
        if (e instanceof api.ApiError && e.status === 409) {
          const body = e.body as { rules: Rules; rulesUpdatedAt: string };
          setState((s) => s && { ...s, rules: body.rules, rulesUpdatedAt: body.rulesUpdatedAt });
          toast('Her plan was just changed on another phone. Showing the latest - try again if needed.');
        } else {
          setState((s) => s && { ...s, rules: before.rules, rulesUpdatedAt: before.rulesUpdatedAt });
          toast(message(e));
        }
      })
      .finally(() => { writes.current--; });
  }, [toast]);

  const addMeal = useCallback(async (type: MealType, items: Item[]) => {
    writes.current++;
    try {
      const meal = await api.addMeal(type, items);
      await api.setSaved(meal.id, true);
      setState((s) => s && { ...s, custom: [...s.custom, meal], saved: [...s.saved, meal.id] });
      return meal;
    } catch (e) {
      toast(message(e));
      return null;
    } finally {
      writes.current--;
    }
  }, [toast]);

  const deleteMeal = useCallback(async (id: string) => {
    await optimistic(
      (s) => ({ ...s, custom: s.custom.filter((m) => m.id !== id), saved: s.saved.filter((x) => x !== id) }),
      () => api.deleteMeal(id),
    );
  }, [optimistic]);

  const value = useMemo<Data>(() => {
    const meals = [...CATALOG, ...(state?.custom ?? [])];
    return {
      state,
      error,
      meals,
      mealById: (id) => meals.find((m) => m.id === id),
      context: contextFrom(state?.log ?? [], now),
      now,
      saved: new Set(state?.saved ?? []),
      pantry: new Set(state?.pantry ?? []),
      refresh, setSaved, setPantry, logMeal, saveRules, addMeal, deleteMeal,
    };
  }, [state, error, now, refresh, setSaved, setPantry, logMeal, saveRules, addMeal, deleteMeal]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/**
 * After a failed write, undo just that write: other changes made since (a
 * refresh, another tap) stay. Saved, at-home and the log are sets of ids, so
 * the change can be reversed field by field.
 */
function restore(before: api.AppState, now: api.AppState, apply: (s: api.AppState) => api.AppState): Partial<api.AppState> {
  const after = apply(before);
  const out: Partial<api.AppState> = {};
  for (const key of ['saved', 'pantry'] as const) {
    if (after[key] === before[key]) continue;
    const added = after[key].filter((x) => !before[key].includes(x));
    const removed = before[key].filter((x) => !after[key].includes(x));
    out[key] = [...now[key].filter((x) => !added.includes(x)), ...removed.filter((x) => !now[key].includes(x))];
  }
  if (after.log !== before.log) {
    const addedIds = after.log.filter((e) => !before.log.some((b) => b.id === e.id)).map((e) => e.id);
    const removed = before.log.filter((e) => !after.log.some((a) => a.id === e.id));
    out.log = [...now.log.filter((e) => !addedIds.includes(e.id)), ...removed.filter((e) => !now.log.some((n) => n.id === e.id))]
      .sort((a, b) => b.eatenAt.localeCompare(a.eatenAt));
  }
  if (after.custom !== before.custom) {
    const removed = before.custom.filter((m) => !after.custom.some((a) => a.id === m.id));
    out.custom = [...now.custom, ...removed.filter((m) => !now.custom.some((n) => n.id === m.id))];
  }
  return out;
}
