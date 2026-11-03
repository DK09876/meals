/**
 * What she is likely to want: the "learning" behind suggestions and the
 * week planner. No model - just what the family has told the app:
 *
 * - a meal marked as a favourite (👍 after eating, or the heart) comes first;
 * - one marked "not for me" (👎) is never suggested again (it can still be
 *   found and un-hidden in Recipes);
 * - meals she has had often lately, and liked, rise a little;
 * - something she had today or yesterday sinks, for variety;
 * - with the at-home list in use, meals she can make from it rise.
 */

import { FOODS } from './foods';
import type { Meal } from './catalog';
import { daysAgo, type LogEntry } from './history';

export type Like = 1 | -1;

export interface Taste {
  likes: ReadonlyMap<string, Like>;
  log: LogEntry[];
  pantry: ReadonlySet<string>;
  now: Date;
}

export const isHidden = (meal: Meal, taste: Pick<Taste, 'likes'>) => taste.likes.get(meal.id) === -1;

export function score(meal: Meal, taste: Taste): number {
  if (isHidden(meal, taste)) return -Infinity;
  let s = 0;
  if (taste.likes.get(meal.id) === 1) s += 40;
  let recent = 0;
  let eatenLately = 0;
  for (const e of taste.log) {
    if (e.mealId !== meal.id) continue;
    const ago = daysAgo(e.eatenAt, taste.now);
    if (ago <= 1) recent++;
    if (ago <= 30) eatenLately++;
  }
  if (taste.likes.get(meal.id) === 1) s += Math.min(15, eatenLately * 3);
  if (recent) s -= 25;
  const shop = meal.items.filter((i) => FOODS[i.food].group !== 'extra');
  if (shop.length) s += 10 * (shop.filter((i) => taste.pantry.has(i.food)).length / shop.length);
  return s;
}

/** Best first; hidden meals dropped; ties keep the given order. */
export function ranked(meals: Meal[], taste: Taste): Meal[] {
  return meals
    .map((meal, index) => ({ meal, index, s: score(meal, taste) }))
    .filter((x) => x.s > -Infinity)
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.meal);
}
