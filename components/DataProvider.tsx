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
import { dayKey } from '@/lib/dates';
import { contextFrom } from '@/lib/history';
import type { World } from '@/lib/plan';
import type { Like, Taste } from '@/lib/rank';
import { adaptMeals, avoidedFoods, NO_RESTRICTIONS, ruledOut, type Restrictions } from '@/lib/restrictions';
import type { Context, Item, MealType, Rules } from '@/lib/rules';
import { useToast } from './Toast';

const POLL_MS = 20_000;

type MealExtra = NonNullable<Parameters<typeof api.addMeal>[2]>;

/** What the server said when a meal did not fit a slot. */
export interface SlotRefusal {
  error: string;
  instead: string[];
  otherDays: string[];
}

interface Data {
  state: api.AppState | null;
  error: string | null;
  /** Built-in and built meals together. */
  meals: Meal[];
  mealById: (id: string) => Meal | undefined;
  context: Context;
  world: World | null;
  taste: Taste;
  now: Date;
  today: string;
  pantry: ReadonlySet<string>;
  likes: ReadonlyMap<string, Like>;
  photo: (mealId: string) => string | null;
  refresh: () => Promise<void>;
  setLike: (mealId: string, value: Like | 0) => void;
  setPantry: (foodId: string, on: boolean) => void;
  logMeal: (meal: Meal, afterLog?: () => void) => Promise<void>;
  saveRules: (changes: Partial<Rules>, restrictions?: Restrictions) => void;
  /** Built-in or built meals she never has, with why ("has fish"). */
  ruledOutMeals: Array<{ meal: Meal; reason: string }>;
  addMeal: (type: MealType, items: Item[], extra?: MealExtra) => Promise<Meal | null>;
  deleteMeal: (id: string) => Promise<void>;
  /** null when it was placed; the refusal when it did not fit. */
  setSlot: (date: string, slot: MealType, mealId: string | null, opts?: { force?: boolean; weekStart?: string }) => Promise<SlotRefusal | null>;
  fillWeek: (start: string) => Promise<void>;
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
  const optimistic = useCallback(async <T,>(apply: (s: api.AppState) => api.AppState, undo: (s: api.AppState, before: api.AppState) => api.AppState, request: () => Promise<T>, failText?: string): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> => {
    const before = latest.current;
    if (!before) return { ok: false, error: new Error('Not loaded') };
    const next = apply(before);
    latest.current = next;
    setState(next);
    writes.current++;
    try {
      return { ok: true, value: await request() };
    } catch (e) {
      setState((s) => s && undo(s, before));
      if (failText !== '') toast(failText ?? message(e));
      return { ok: false, error: e };
    } finally {
      writes.current--;
    }
  }, [toast]);

  const setLike = useCallback((mealId: string, value: Like | 0) => {
    const put = (likes: Record<string, Like>, v: Like | 0 | undefined) => {
      const out = { ...likes };
      if (v === 0 || v === undefined) delete out[mealId];
      else out[mealId] = v;
      return out;
    };
    optimistic(
      (s) => ({ ...s, likes: put(s.likes, value) }),
      (s, before) => ({ ...s, likes: put(s.likes, before.likes[mealId]) }),
      () => api.setLike(mealId, value),
    );
  }, [optimistic]);

  const setPantry = useCallback((foodId: string, on: boolean) => {
    const put = (list: string[], v: boolean) => (v ? [...new Set([...list, foodId])] : list.filter((id) => id !== foodId));
    optimistic(
      (s) => ({ ...s, pantry: put(s.pantry, on) }),
      (s, before) => ({ ...s, pantry: put(s.pantry, before.pantry.includes(foodId)) }),
      () => api.setPantry(foodId, on),
    );
  }, [optimistic]);

  const logMeal = useCallback(async (meal: Meal, afterLog?: () => void) => {
    const temp = { id: `pending-${Date.now()}`, mealId: meal.id, name: meal.name, type: meal.type, items: meal.items, eatenAt: new Date().toISOString() };
    const result = await optimistic(
      (s) => ({ ...s, log: [temp, ...s.log] }),
      (s) => ({ ...s, log: s.log.filter((e) => e.id !== temp.id) }),
      () => api.logMeal(meal.id),
      'Could not save that. Try again.',
    );
    if (!result.ok) return;
    const entry = result.value;
    setState((s) => s && { ...s, log: s.log.map((e) => (e.id === temp.id ? entry : e)) });
    setNow(new Date());
    toast(`Saved: ${meal.name}.`, {
      label: 'Undo',
      run: () => {
        optimistic(
          (s) => ({ ...s, log: s.log.filter((e) => e.id !== entry.id) }),
          (s) => ({ ...s, log: [entry, ...s.log] }),
          () => api.unlog(entry.id),
        );
      },
    });
    afterLog?.();
  }, [optimistic, toast]);

  // Saves to her limits go one at a time, each from the version the one before
  // it produced - so quick taps on this phone never trip the check meant for
  // a change made on another phone.
  const rulesQueue = useRef<Promise<void>>(Promise.resolve());
  const rulesPending = useRef(0);
  const saveRules = useCallback((changes: Partial<Rules>, restrictions?: Restrictions) => {
    const before = latest.current;
    if (!before) return;
    const next = { ...before, rules: { ...before.rules, ...changes }, restrictions: restrictions ?? before.restrictions };
    latest.current = next;
    setState(next);
    writes.current++;
    rulesPending.current++;
    rulesQueue.current = rulesQueue.current.then(async () => {
      const base = latest.current?.rulesUpdatedAt ?? before.rulesUpdatedAt;
      try {
        const r = await api.patchRules(changes, base, restrictions);
        rulesPending.current--;
        // Later taps are still on their way: keep showing them, just move the version on.
        const settled = rulesPending.current === 0;
        const apply = (s: api.AppState) => (settled ? { ...s, rules: r.rules, restrictions: r.restrictions, rulesUpdatedAt: r.rulesUpdatedAt } : { ...s, rulesUpdatedAt: r.rulesUpdatedAt });
        if (latest.current) latest.current = apply(latest.current);
        setState((s) => s && apply(s));
      } catch (e) {
        rulesPending.current--;
        if (e instanceof api.ApiError && e.status === 409) {
          const body = e.body as { rules: Rules; restrictions: Restrictions; rulesUpdatedAt: string };
          const apply = (s: api.AppState) => ({ ...s, rules: body.rules, restrictions: body.restrictions, rulesUpdatedAt: body.rulesUpdatedAt });
          if (latest.current) latest.current = apply(latest.current);
          setState((s) => s && apply(s));
          toast('Her plan was just changed on another phone. Showing the latest - try again if needed.');
        } else {
          setState((s) => s && { ...s, rules: before.rules, restrictions: before.restrictions, rulesUpdatedAt: s.rulesUpdatedAt });
          toast(message(e));
        }
      } finally {
        writes.current--;
      }
    });
  }, [toast]);

  const addMeal = useCallback(async (type: MealType, items: Item[], extra: MealExtra = {}) => {
    writes.current++;
    try {
      const meal = await api.addMeal(type, items, extra);
      setState((s) => s && { ...s, custom: [...s.custom, meal] });
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
      (s) => ({ ...s, custom: s.custom.filter((m) => m.id !== id), plan: s.plan.filter((p) => p.mealId !== id) }),
      (s, before) => ({ ...s, custom: before.custom, plan: before.plan }),
      () => api.deleteMeal(id),
    );
  }, [optimistic]);

  const setSlot = useCallback(async (date: string, slot: MealType, mealId: string | null, opts: { force?: boolean; weekStart?: string } = {}) => {
    const put = (plan: api.AppState['plan'], id: string | null | undefined) => {
      const rest = plan.filter((p) => !(p.date === date && p.slot === slot));
      return id ? [...rest, { date, slot, mealId: id }] : rest;
    };
    const result = await optimistic(
      (s) => ({ ...s, plan: put(s.plan, mealId) }),
      (s, before) => ({ ...s, plan: put(s.plan, before.plan.find((p) => p.date === date && p.slot === slot)?.mealId) }),
      () => api.setSlot(date, slot, mealId, opts),
      '',
    );
    if (result.ok) return null;
    const e = result.error;
    if (e instanceof api.ApiError && e.status === 422) {
      const body = e.body as { error: string; instead?: string[]; otherDays?: string[] };
      return { error: body.error, instead: body.instead ?? [], otherDays: body.otherDays ?? [] };
    }
    toast(message(e));
    return { error: message(e), instead: [], otherDays: [] };
  }, [optimistic, toast]);

  const fillWeek = useCallback(async (start: string) => {
    writes.current++;
    try {
      const added = await api.fillWeek(start);
      toast(added ? `Added ${added} ${added === 1 ? 'meal' : 'meals'}. Tap any to swap it.` : 'Every meal of the week is already planned.');
    } catch (e) {
      toast(message(e));
    } finally {
      writes.current--;
    }
    await refresh();
  }, [refresh, toast]);

  const value = useMemo<Data>(() => {
    const all = [...CATALOG, ...(state?.custom ?? [])];
    const restrictions = state?.restrictions ?? NO_RESTRICTIONS;
    // Only what she can have is offered, adapted ("made without mushrooms"); anything
    // planned or eaten before keeps its stored form so history still reads right.
    const meals = adaptMeals(all, restrictions);
    const adapted = new Map(meals.map((m) => [m.id, m]));
    const stored = new Map(all.map((m) => [m.id, m]));
    const lookup = (id: string) => adapted.get(id) ?? stored.get(id);
    const ruledOutMeals = all.filter((m) => !adapted.has(m.id)).map((m) => ({ meal: m, reason: ruledOut(m, restrictions) ?? '' }));
    const likes = new Map(Object.entries(state?.likes ?? {})) as Map<string, Like>;
    const pantry = new Set(state?.pantry ?? []);
    return {
      state,
      error,
      meals,
      mealById: lookup,
      ruledOutMeals,
      context: contextFrom(state?.log ?? [], now),
      world: state ? { plan: state.plan, log: state.log, rules: state.rules, meal: lookup, ruledOut: (id) => (adapted.has(id) || !stored.has(id) ? null : ruledOut(stored.get(id)!, restrictions)), avoided: avoidedFoods(restrictions) } : null,
      taste: { likes, log: state?.log ?? [], pantry, now },
      now,
      today: dayKey(now),
      pantry,
      likes,
      photo: (id) => api.photoUrl(id, state?.photos[id]),
      refresh, setLike, setPantry, logMeal, saveRules, addMeal, deleteMeal, setSlot, fillWeek,
    };
  }, [state, error, now, refresh, setLike, setPantry, logMeal, saveRules, addMeal, deleteMeal, setSlot, fillWeek]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
