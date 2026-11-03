/**
 * Her week: a meal in each slot (breakfast, lunch, dinner, snack) of each day.
 *
 * Checking a slot means checking it with the rest of its day and week:
 * cholesterol and saturated fat are daily budgets, egg yolks a budget over
 * any seven days in a row. What a day "has" is, for each meal of the day,
 * the planned meal - or, where nothing is planned, what she actually ate.
 *
 * Nothing here decides for her. Adding a meal that does not fit is allowed
 * to be attempted; the app answers with meals that do fit that slot, and with
 * other days where the one she picked would fit.
 */

import type { Meal } from './catalog';
import { addDays, keyOfIso, type DayKey } from './dates';
import type { LogEntry } from './history';
import { ranked, type Taste } from './rank';
import { evaluate, MEAL_TYPES, totals, type Context, type Evaluation, type Item, type MealType, type Rules } from './rules';

export interface PlanEntry {
  date: DayKey;
  slot: MealType;
  mealId: string;
}

export interface World {
  plan: PlanEntry[];
  log: LogEntry[];
  rules: Rules;
  meal: (id: string) => Meal | undefined;
}

const SLOTS = MEAL_TYPES.map((t) => t.id);

export const planned = (world: World, date: DayKey, slot: MealType) =>
  world.plan.find((p) => p.date === date && p.slot === slot);

/**
 * Everything that counts toward a day, leaving one slot out. What she
 * actually ate wins over what was planned: if lunch was planned as soup but
 * she had the wrap, the wrap is what the rest of the day is checked against.
 */
function dayItems(world: World, date: DayKey, except?: MealType): Item[][] {
  const out: Item[][] = [];
  for (const slot of SLOTS) {
    if (slot === except) continue;
    const eaten = world.log.filter((e) => e.type === slot && keyOfIso(e.eatenAt) === date);
    if (eaten.length) {
      for (const e of eaten) out.push(e.items);
      continue;
    }
    const p = planned(world, date, slot);
    const meal = p && world.meal(p.mealId);
    if (meal) out.push(meal.items);
  }
  return out;
}

const sum = (lists: Item[][]) => lists.reduce(
  (acc, items) => {
    const t = totals(items);
    return { cholesterol: acc.cholesterol + t.cholesterol, satFat: acc.satFat + t.satFat, yolks: acc.yolks + t.yolks };
  },
  { cholesterol: 0, satFat: 0, yolks: 0 },
);

/**
 * What the rest of the plan already uses, as seen from one slot. Yolks are
 * the worst of the seven 7-day windows that include this day, so a plan can
 * never put more than her limit into any week.
 */
export function slotContext(world: World, date: DayKey, slot: MealType): Context {
  const today = sum(dayItems(world, date, slot));
  let yolks = 0;
  for (let start = -6; start <= 0; start++) {
    let w = 0;
    for (let d = 0; d < 7; d++) {
      const day = addDays(date, start + d);
      w += sum(dayItems(world, day, day === date ? slot : undefined)).yolks;
    }
    yolks = Math.max(yolks, w);
  }
  return { cholesterolToday: today.cholesterol, satFatToday: today.satFat, yolksThisWeek: yolks };
}

export const checkSlot = (world: World, date: DayKey, slot: MealType, meal: Meal): Evaluation =>
  evaluate(meal.items, slot, world.rules, slotContext(world, date, slot));

/** The plan with one slot set (or cleared, with null). */
export function withSlot(world: World, date: DayKey, slot: MealType, mealId: string | null): World {
  const plan = world.plan.filter((p) => !(p.date === date && p.slot === slot));
  if (mealId) plan.push({ date, slot, mealId });
  return { ...world, plan };
}

export interface Alternatives {
  /** Meals that fit this slot, her favourites first. */
  instead: Meal[];
  /** Other days this week where the meal she picked fits the same slot. */
  otherDays: DayKey[];
}

export function alternatives(world: World, meals: Meal[], taste: Taste, date: DayKey, slot: MealType, picked: Meal, weekStart: DayKey, count = 3): Alternatives {
  // Not the one she picked, and not what the slot already has - those are no change.
  const current = planned(world, date, slot)?.mealId;
  const instead = ranked(meals.filter((m) => m.type === slot && m.id !== picked.id && m.id !== current), taste)
    .filter((m) => checkSlot(world, date, slot, m).fits)
    .slice(0, count);
  const otherDays: DayKey[] = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays(weekStart, d);
    if (day === date || planned(world, day, slot)) continue;
    if (checkSlot(world, day, slot, picked).fits) otherDays.push(day);
  }
  return { instead, otherDays };
}

/**
 * Fills the empty slots of seven days, one at a time, each pick checked
 * against everything picked before it. Favourites first; a meal already used
 * in the week, or the day before, is pushed back for variety. A slot nothing
 * fits is left empty rather than filled with something over a limit.
 */
export function fillWeek(world: World, meals: Meal[], taste: Taste, start: DayKey, days = 7): PlanEntry[] {
  let w = world;
  const added: PlanEntry[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d);
    for (const slot of SLOTS) {
      if (planned(w, date, slot)) continue;
      const usedThisWeek = new Map<string, number>();
      for (const p of w.plan) if (p.date >= start && p.date < addDays(start, days)) usedThisWeek.set(p.mealId, (usedThisWeek.get(p.mealId) ?? 0) + 1);
      const yesterday = planned(w, addDays(date, -1), slot)?.mealId;
      const options = ranked(meals.filter((m) => m.type === slot), taste)
        .map((m, i) => ({ m, s: -i - (usedThisWeek.get(m.id) ?? 0) * 6 - (m.id === yesterday ? 20 : 0) }))
        .sort((a, b) => b.s - a.s);
      const pick = options.find((o) => checkSlot(w, date, slot, o.m).fits);
      if (!pick) continue;
      w = withSlot(w, date, slot, pick.m.id);
      added.push({ date, slot, mealId: pick.m.id });
    }
  }
  return added;
}

/** Has she eaten what was planned for this slot? */
export const eatenFor = (log: LogEntry[], date: DayKey, slot: MealType) =>
  log.find((e) => e.type === slot && keyOfIso(e.eatenAt) === date);
