/** One profile's whole picture, from the database, for the planner and suggestions on the server. */

import { CATALOG, type Meal } from './catalog';
import { addDays, dayKey } from './dates';
import { getRules, listCustomMeals, listLikes, listLog, listPantry, listPlan } from './db';
import type { World } from './plan';
import type { Taste } from './rank';

export function loadWorld(profileId: string, now = new Date()): { world: World; meals: Meal[]; taste: Taste } {
  const meals = [...CATALOG, ...listCustomMeals(profileId)];
  const byId = new Map(meals.map((m) => [m.id, m]));
  const log = listLog(profileId);
  const world: World = {
    plan: listPlan(profileId, addDays(dayKey(now), -14)),
    log,
    rules: getRules(profileId).rules,
    meal: (id) => byId.get(id),
  };
  const taste: Taste = { likes: new Map(Object.entries(listLikes(profileId))), log, pantry: new Set(listPantry(profileId)), now };
  return { world, meals, taste };
}
