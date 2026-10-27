/**
 * Which meal ideas to offer, in what order.
 *
 * Only meals that pass every check right now are offered - including today's
 * cholesterol and this week's egg yolks - so nothing over a limit is ever
 * suggested. Among those: with "use what's at home" on, the ones needing the
 * fewest groceries first; and anything she had today or yesterday goes to the
 * back, for variety. Otherwise the catalog's own order.
 */

import { FOODS } from './foods';
import type { Meal } from './catalog';
import { daysAgo, type LogEntry } from './history';
import { evaluate, type Context, type Evaluation, type Item, type MealType, type Rules } from './rules';

export interface Idea {
  meal: Meal;
  evaluation: Evaluation;
  /** Items not on the at-home list. Sauces and seasonings are never "missing". */
  missing: Item[];
}

export function missingItems(meal: Meal, pantry: ReadonlySet<string>): Item[] {
  return meal.items.filter((item) => FOODS[item.food].group !== 'extra' && !pantry.has(item.food));
}

export interface IdeaOptions {
  type: MealType;
  rules: Rules;
  context: Context;
  pantry: ReadonlySet<string>;
  useHome: boolean;
  log: LogEntry[];
  now: Date;
}

export function ideas(meals: Meal[], o: IdeaOptions): Idea[] {
  const recent = new Set(o.log.filter((e) => daysAgo(e.eatenAt, o.now) <= 1).map((e) => e.mealId));
  return meals
    .filter((meal) => meal.type === o.type)
    .map((meal, index) => ({ meal, index, evaluation: evaluate(meal.items, meal.type, o.rules, o.context), missing: missingItems(meal, o.pantry) }))
    .filter((x) => x.evaluation.fits)
    .sort((a, b) =>
      (o.useHome ? a.missing.length - b.missing.length : 0)
      || Number(recent.has(a.meal.id)) - Number(recent.has(b.meal.id))
      || a.index - b.index)
    .map(({ meal, evaluation, missing }) => ({ meal, evaluation, missing }));
}

/** The meal she is most likely to want next, by the clock. */
export function mealTypeAt(now: Date): MealType {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 14.5) return 'lunch';
  if (h < 16.5) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}
