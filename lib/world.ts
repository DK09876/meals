/** One profile's whole picture, from the database, for the planner and suggestions on the server. */

import { CATALOG, type Meal } from './catalog';
import { addDays, dayKey } from './dates';
import { getRules, listCustomMeals, listLikes, listLog, listPantry, listPlan } from './db';
import type { World } from './plan';
import type { Taste } from './rank';
import { adaptMeals, avoidedFoods, ruledOut } from './restrictions';

export function loadWorld(profileId: string, now = new Date()): { world: World; meals: Meal[]; taste: Taste } {
  const { rules, restrictions } = getRules(profileId);
  const all = [...CATALOG, ...listCustomMeals(profileId)];
  // Only what she can have is offered; anything planned before keeps its stored form.
  const meals = adaptMeals(all, restrictions);
  const adapted = new Map(meals.map((m) => [m.id, m]));
  const stored = new Map(all.map((m) => [m.id, m]));
  const log = listLog(profileId);
  const world: World = {
    plan: listPlan(profileId, addDays(dayKey(now), -14)),
    log,
    rules,
    meal: (id) => adapted.get(id) ?? stored.get(id),
    ruledOut: (id) => (adapted.has(id) || !stored.has(id) ? null : ruledOut(stored.get(id)!, restrictions)),
    avoided: avoidedFoods(restrictions),
  };
  const taste: Taste = { likes: new Map(Object.entries(listLikes(profileId))), log, pantry: new Set(listPantry(profileId)), now };
  return { world, meals, taste };
}
