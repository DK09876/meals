'use client';

/**
 * "Make it work": every way to have a meal that does not fit where she
 * wants it (lib/resolve.ts) - change the recipe, change another meal that
 * day or later in the week, have it another day, or have something else.
 * One tap applies it; each was checked against the whole plan first.
 */

import { useMemo, useState } from 'react';

import { useData } from './DataProvider';
import MealPhoto from './MealPhoto';
import { useToast } from './Toast';
import { Icon, type IconName } from './ui';
import type { Meal } from '@/lib/catalog';
import { dayName, type DayKey } from '@/lib/dates';
import { useMode } from '@/lib/mode';
import { fixesFor, type Fix } from '@/lib/resolve';
import { mealTypeLabel, type MealType } from '@/lib/rules';

const HEADINGS: Record<Fix['kind'], { label: string; icon: IconName }> = {
  adjust: { label: 'Change this recipe', icon: 'wand' },
  swapOther: { label: 'Change another meal to make room', icon: 'calendar' },
  otherDay: { label: 'Have it another day', icon: 'calendar' },
  instead: { label: 'Or have something else', icon: 'bulb' },
};

export function useApplyFix() {
  const { setSlot, addMeal, mealById, today } = useData();
  const toast = useToast();
  /** `moving`: the meal is already planned at date/slot (a heads-up), so "another day" moves it. */
  return async (fix: Fix, date: DayKey, slot: MealType, picked: Meal, moving = false): Promise<boolean> => {
    const where = (d: DayKey) => `${dayName(d, today).toLowerCase() === 'today' ? 'today' : dayName(d, today)}'s ${mealTypeLabel(slot).toLowerCase()}`;
    if (fix.kind === 'adjust') {
      const copy = await addMeal(slot, fix.items, {
        name: picked.name.includes('(adjusted)') ? picked.name : `${picked.name} (adjusted)`,
        steps: picked.steps, minutes: picked.minutes, note: `Adjusted to fit: ${fix.text.charAt(0).toLowerCase()}${fix.text.slice(1)}.`, source: 'fixed',
      });
      if (!copy || (await setSlot(date, slot, copy.id))) return false;
      toast(`${copy.name} is on ${where(date)}.`);
      return true;
    }
    if (fix.kind === 'swapOther') {
      if (await setSlot(fix.date, fix.slot, fix.toMealId)) return false;
      if (await setSlot(date, slot, picked.id)) return false;
      toast(`Done: ${mealById(fix.toMealId)?.name} moved in, and ${picked.name} is on ${where(date)}.`);
      return true;
    }
    if (fix.kind === 'otherDay') {
      if (await setSlot(fix.date, slot, picked.id)) return false;
      if (moving) await setSlot(date, slot, null);
      toast(`${picked.name} is on ${where(fix.date)}.`);
      return true;
    }
    if (await setSlot(date, slot, fix.mealId)) return false;
    toast(`${mealById(fix.mealId)?.name} is on ${where(date)}.`);
    return true;
  };
}

export default function MakeItWork({ date, slot, meal, onDone, fixes: given, moving = false }: { date: DayKey; slot: MealType; meal: Meal; onDone: () => void; fixes?: Fix[]; moving?: boolean }) {
  const { world, meals, taste, today, mealById } = useData();
  const grandma = useMode() === 'grandma';
  const apply = useApplyFix();
  const [busy, setBusy] = useState(false);
  const fixes = useMemo(() => given ?? (world ? fixesFor(world, meals, taste, date, slot, meal, today) : []), [given, world, meals, taste, date, slot, meal, today]);
  if (!fixes.length) return <p className="text-[15px] text-muted">Nothing fits that day. Try another day.</p>;

  const groups = (Object.keys(HEADINGS) as Fix['kind'][]).map((k) => ({ kind: k, items: fixes.filter((f) => f.kind === k) })).filter((g) => g.items.length);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-field/60 p-3" aria-label="Ways to make it work">
      <p className="text-[15px] font-bold">{moving ? 'Ways to fix it:' : grandma ? 'Here’s how you could still have it:' : 'Ways to make it work:'}</p>
      {groups.map((g) => (
        <section key={g.kind} className="flex flex-col gap-1.5" aria-label={HEADINGS[g.kind].label}>
          <h3 className="label flex items-center gap-1.5"><Icon name={HEADINGS[g.kind].icon} size={16} />{HEADINGS[g.kind].label}</h3>
          {g.items.map((f) => {
            const photoMeal = f.kind === 'instead' ? mealById(f.mealId) : f.kind === 'swapOther' ? mealById(f.toMealId) : undefined;
            return (
              <button
                key={f.text}
                disabled={busy}
                onClick={async () => { setBusy(true); const ok = await apply(f, date, slot, meal, moving); setBusy(false); if (ok) onDone(); }}
                className="flex min-h-14 items-center gap-3 rounded-xl bg-surface p-2.5 text-left"
              >
                {photoMeal && <MealPhoto meal={photoMeal} className="size-11 shrink-0" rounded="rounded-lg" />}
                <span className="flex-1 text-[16px] font-bold leading-snug">{f.text}</span>
                <Icon name="plus" size={20} className="shrink-0 text-accent" />
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
