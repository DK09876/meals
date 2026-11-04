/**
 * Ways to make a meal work when it does not fit where she wants it - and
 * heads-ups for planned meals that no longer fit.
 *
 * A meal can break a limit because of itself (too many carbs, too salty) or
 * because of what is around it: the rest of the day (cholesterol, saturated
 * fat) or the week (egg yolks). So the ways out are, in order:
 *
 * 1. change this recipe - the smallest swap that makes it fit (lib/swaps.ts);
 * 2. change something else planned that day, so there is room for it;
 * 3. change a meal planned on another day of the same seven, for egg yolks;
 * 4. have it on another day where it fits;
 * 5. have something else in this slot.
 *
 * Every option is tried on a copy of the plan, and offered only if the
 * picked meal then fits AND every other planned meal still fits - a fix
 * never quietly breaks a different day.
 */

import type { Meal } from './catalog';
import { addDays, dayName, type DayKey } from './dates';
import { alternatives, checkSlot, eatenFor, planned, slotContext, withSlot, type World } from './plan';
import { ranked, type Taste } from './rank';
import { MEAL_TYPES, mealTypeLabel, type CheckKind, type Item, type MealType } from './rules';
import { makeItFit } from './swaps';

export type Fix =
  /** Save an adjusted copy of the picked recipe and put that in the slot. */
  | { kind: 'adjust'; text: string; items: Item[] }
  /** Put `toMealId` in another slot first, then the picked meal fits. */
  | { kind: 'swapOther'; text: string; date: DayKey; slot: MealType; toMealId: string }
  /** Have the picked meal on another day instead. */
  | { kind: 'otherDay'; text: string; date: DayKey }
  /** Have a different meal in this slot. */
  | { kind: 'instead'; text: string; mealId: string };

const SLOTS = MEAL_TYPES.map((t) => t.id);
const DAILY: CheckKind[] = ['cholesterol', 'satFat'];

/** Every planned, not-yet-eaten meal from `from` on still fits. */
function planHolds(world: World, from: DayKey, to: DayKey): boolean {
  for (const p of world.plan) {
    if (p.date < from || p.date > to || eatenFor(world.log, p.date, p.slot)) continue;
    const meal = world.meal(p.mealId);
    if (meal && !checkSlot(world, p.date, p.slot, meal).fits) return false;
  }
  return true;
}


export function fixesFor(world: World, meals: Meal[], taste: Taste, date: DayKey, slot: MealType, picked: Meal, today: DayKey, limit = 6): Fix[] {
  // The picked meal leaves the slot it is being considered for while we look.
  const base = withSlot(world, date, slot, null);
  const evaluation = checkSlot(base, date, slot, picked);
  if (evaluation.fits) return [];
  const failing = evaluation.checks.filter((c) => c.status === 'fail').map((c) => c.kind);
  const span = { from: addDays(date, -6) < today ? today : addDays(date, -6), to: addDays(date, 6) };
  const day = (d: DayKey) => { const n = dayName(d, today); return n === 'Today' || n === 'Tomorrow' ? n.toLowerCase() : n; };
  const fixes: Fix[] = [];

  // 1. Change this recipe - kept only if the rest of the plan still fits around the changed copy.
  for (const adjust of makeItFit(picked.items, slot, world.rules, slotContext(base, date, slot), 3, world.avoided)) {
    const copy: Meal = { ...picked, id: '__adjusted', items: adjust.items };
    const placed: World = { ...withSlot(base, date, slot, copy.id), meal: (id) => (id === copy.id ? copy : base.meal(id)) };
    if (!planHolds(placed, span.from, span.to)) continue;
    fixes.push({ kind: 'adjust', text: adjust.text, items: adjust.items });
    break;
  }

  // 2 and 3. Make room by changing another planned meal - that day for daily
  // limits, any day sharing a seven-day window for egg yolks.
  const days: DayKey[] = [];
  if (failing.some((k) => DAILY.includes(k))) days.push(date);
  if (failing.includes('yolks')) for (let d = -6; d <= 6; d++) if (d !== 0) days.push(addDays(date, d));
  const intrinsic = failing.some((k) => !DAILY.includes(k) && k !== 'yolks');
  if (!intrinsic) {
    for (const d of days) {
      if (d < today) continue;
      for (const s of SLOTS) {
        if (d === date && s === slot) continue;
        const p = planned(base, d, s);
        if (!p || eatenFor(world.log, d, s)) continue;
        const current = base.meal(p.mealId);
        if (!current) continue;
        // Only a meal that adds to what is over can make room.
        const helps = failing.includes('yolks') ? current.items.some((i) => i.food === 'egg') : true;
        if (!helps) continue;
        for (const r of ranked(meals.filter((m) => m.type === s && m.id !== current.id && m.id !== picked.id), taste)) {
          const swapped = withSlot(base, d, s, r.id);
          const placed = withSlot(swapped, date, slot, picked.id);
          if (!checkSlot(placed, date, slot, picked).fits || !planHolds(placed, span.from, span.to)) continue;
          fixes.push({ kind: 'swapOther', date: d, slot: s, toMealId: r.id, text: `Have ${r.name} for ${day(d)}'s ${mealTypeLabel(s).toLowerCase()} instead of ${current.name}` });
          break;
        }
        if (fixes.filter((f) => f.kind === 'swapOther').length >= 2) break;
      }
      if (fixes.filter((f) => f.kind === 'swapOther').length >= 2) break;
    }
  }

  // 4 and 5. Another day, or another meal.
  const alt = alternatives(world, meals, taste, date, slot, picked, today);
  for (const d of alt.otherDays.slice(0, 2)) fixes.push({ kind: 'otherDay', date: d, text: `Have it ${day(d) === 'tomorrow' ? 'tomorrow' : `on ${day(d)}`} instead` });
  for (const m of alt.instead.slice(0, 3)) fixes.push({ kind: 'instead', mealId: m.id, text: `Have ${m.name} instead` });
  return fixes.slice(0, limit);
}

export interface Problem {
  date: DayKey;
  slot: MealType;
  meal: Meal;
  /** Why it no longer fits, in the checks' own words. */
  reason: string;
  fixes: Fix[];
}

/**
 * Planned meals from today on that no longer fit - because of what she
 * actually ate, a change to her limits, or a change elsewhere in the plan -
 * each with ways to make it work.
 */
export function problems(world: World, meals: Meal[], taste: Taste, from: DayKey, days: number, today: DayKey): Problem[] {
  const out: Problem[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(from, d);
    if (date < today) continue;
    for (const slot of SLOTS) {
      const p = planned(world, date, slot);
      if (!p || eatenFor(world.log, date, slot)) continue;
      const meal = world.meal(p.mealId);
      if (!meal) continue;
      const avoided = world.ruledOut?.(meal.id);
      if (avoided) {
        const base = withSlot(world, date, slot, null);
        const instead = alternatives(base, meals, taste, date, slot, meal, today).instead.slice(0, 3);
        out.push({ date, slot, meal, reason: `it ${avoided}, which she doesn't eat`, fixes: instead.map((m) => ({ kind: 'instead' as const, mealId: m.id, text: `Have ${m.name} instead` })) });
        continue;
      }
      const evaluation = checkSlot(world, date, slot, meal);
      if (evaluation.fits) continue;
      out.push({ date, slot, meal, reason: evaluation.verdict.text, fixes: fixesFor(world, meals, taste, date, slot, meal, today, 4) });
    }
  }
  return out;
}
