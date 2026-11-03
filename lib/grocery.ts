/**
 * The grocery list: everything the planned meals need over a stretch of
 * days, added up per food, minus what is already at home.
 *
 * Amounts are the recipe amounts added up ("3 × 3 oz cooked" becomes "9 oz
 * cooked"), so whoever shops sees how much the week really uses. Ticking an
 * item as bought puts it on the at-home list, which is what takes it off.
 *
 * Each item carries the words to search for on Instacart - naming the
 * low-sodium or no-salt version where it matters, because Instacart has no
 * low-sodium filter of its own and the shopper picks the product.
 */

import type { Meal } from './catalog';
import { addDays, type DayKey } from './dates';
import { FOODS, GROUPS, type FoodGroup } from './foods';
import { fraction } from './format';
import { eatenFor, type World } from './plan';
import { MEAL_TYPES } from './rules';

/** What to type into a store search, where the food table's name is not it. */
const SHOP: Record<string, string> = {
  oats: 'old fashioned rolled oats',
  wwbread: 'whole wheat bread',
  tortilla: 'whole wheat tortillas',
  wwpasta: 'whole wheat pasta',
  lentils: 'dry lentils',
  blackbeans: 'no salt added black beans',
  chickpeas: 'no salt added chickpeas',
  sweetpot: 'sweet potatoes',
  milk: 'skim milk',
  soymilk: 'unsweetened soy milk',
  greekyog: 'plain nonfat greek yogurt',
  egg: 'eggs',
  eggwhite: 'liquid egg whites',
  chicken: 'boneless skinless chicken breast',
  salmon: 'salmon fillet',
  cod: 'cod fillet',
  turkey: 'turkey breast roast',
  tofu: 'firm tofu',
  cottage: 'no salt added cottage cheese',
  greens: 'salad greens',
  peppers: 'bell peppers',
  almonds: 'unsalted almonds',
  walnuts: 'walnut halves',
  pb: 'natural peanut butter no salt',
  oliveoil: 'extra virgin olive oil',
  hummus: 'hummus',
  seeds: 'unsalted pumpkin seeds',
  lssoy: 'low sodium soy sauce',
};

export const shopName = (food: string) => SHOP[food] ?? FOODS[food].name.split(',')[0].toLowerCase();

export function instacartLink(food: string, store: string): string {
  const path = store ? `store/${encodeURIComponent(store)}/s` : 'store/s';
  return `https://www.instacart.com/${path}?k=${encodeURIComponent(shopName(food))}`;
}

const NUMBER: Record<string, number> = { '¼': 0.25, '⅓': 1 / 3, '½': 0.5, '⅔': 2 / 3, '¾': 0.75 };

/** "½ cup cooked" × 3 → "1½ cups cooked"; "3 oz cooked" × 3 → "9 oz cooked". */
export function scaleServing(serving: string, times: number): string {
  const m = serving.match(/^(\d+)?\s*([¼⅓½⅔¾])?\s*(.*)$/);
  if (!m || (!m[1] && !m[2])) return `${fraction(times)} × ${serving}`;
  const qty = (m[1] ? Number(m[1]) : 0) + (m[2] ? NUMBER[m[2]] : 0);
  const total = qty * times;
  let rest = m[3];
  if (total > 1) {
    rest = rest
      .replace(/^cup\b/, 'cups')
      .replace(/^slice\b/, 'slices')
      .replace(/^large\b/, 'large')
      .replace(/^small\b/, 'small');
  }
  return `${fraction(Math.round(total * 12) / 12)} ${rest}`.trim();
}

export interface GroceryLine {
  food: string;
  name: string;
  group: FoodGroup;
  servings: number;
  amount: string;
  /** The planned meals that use it, by name. */
  meals: string[];
  atHome: boolean;
  search: string;
}

/**
 * Every planned meal from `from` for `days` days that she has not eaten yet,
 * added up per food. Lines come grouped as the food table groups them.
 */
export function groceryList(world: World, from: DayKey, days: number, pantry: ReadonlySet<string>): { lines: GroceryLine[]; mealCount: number } {
  const byFood = new Map<string, { servings: number; meals: Set<string> }>();
  let mealCount = 0;
  for (let d = 0; d < days; d++) {
    const date = addDays(from, d);
    for (const { id: slot } of MEAL_TYPES) {
      const p = world.plan.find((x) => x.date === date && x.slot === slot);
      const meal: Meal | undefined = p && world.meal(p.mealId);
      if (!meal || eatenFor(world.log, date, slot)) continue;
      mealCount++;
      for (const item of meal.items) {
        const line = byFood.get(item.food) ?? { servings: 0, meals: new Set<string>() };
        line.servings += item.servings;
        line.meals.add(meal.name);
        byFood.set(item.food, line);
      }
    }
  }
  const order = [...GROUPS.map((g) => g.id), 'extra'];
  const lines = [...byFood.entries()]
    .map(([food, x]) => ({
      food,
      name: FOODS[food].name,
      group: FOODS[food].group,
      servings: x.servings,
      amount: scaleServing(FOODS[food].serving, x.servings),
      meals: [...x.meals],
      atHome: pantry.has(food),
      search: shopName(food),
    }))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name));
  return { lines, mealCount };
}

/** The list as plain text, for Messages, Notes or Reminders. */
export function groceryText(lines: GroceryLine[], title: string): string {
  const need = lines.filter((l) => !l.atHome);
  return [title, '', ...need.map((l) => `• ${l.search} - ${l.amount}`)].join('\n');
}

/** Instacart's store pages are /store/<slug>; a slug is lower case letters, digits and dashes. */
export const isStoreSlug = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{0,60}$/.test(v);
