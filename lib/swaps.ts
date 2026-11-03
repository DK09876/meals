/**
 * "Make it fit": small changes to a meal that bring it inside her limits,
 * worked out from the food table - no model involved.
 *
 * Each candidate change is applied and the whole meal checked again; only
 * changes that make it fit are offered. Single changes come first (the
 * smallest edit to the recipe), then pairs of them.
 */

import { FOODS, type FoodGroup } from './foods';
import { fraction } from './format';
import { evaluate, type Context, type Item, type MealType, type Rules } from './rules';

export interface Fix {
  /** Plain words: "Use ⅓ cup brown rice instead of ½ cup". */
  text: string;
  items: Item[];
}

interface Change {
  text: string;
  apply: (items: Item[]) => Item[];
}

const name = (id: string) => FOODS[id].name.split(',')[0].toLowerCase();
const amount = (id: string, servings: number) => `${fraction(servings)} × ${FOODS[id].serving}`;
const CARB_GROUPS: FoodGroup[] = ['starch', 'fruit', 'milk'];

/** Lower-carb stand-ins for a starch, shown in the recipe's own terms. */
const STARCH_SWAPS: Record<string, Array<{ food: string; text: string }>> = {
  brownrice: [{ food: 'cauliflower', text: 'cauliflower rice' }, { food: 'quinoa', text: 'quinoa' }],
  wwpasta: [{ food: 'zucchini', text: 'zucchini noodles' }],
  sweetpot: [{ food: 'cauliflower', text: 'roasted cauliflower' }],
  tortilla: [{ food: 'greens', text: 'a lettuce wrap' }],
  wwbread: [{ food: 'greens', text: 'a lettuce wrap' }],
};

const PAIRINGS = [
  { food: 'almonds', servings: 1, text: 'Add 6 almonds on the side' },
  { food: 'pb', servings: 1, text: 'Add 1 Tbsp peanut butter' },
  { food: 'greekyog', servings: 0.5, text: 'Add a few spoons of Greek yogurt' },
  { food: 'walnuts', servings: 1, text: 'Add 4 walnut halves' },
];

const SALT_SWAPS: Record<string, Array<{ food: string }>> = {
  tortilla: [{ food: 'wwbread' }],
  hummus: [{ food: 'avocado' }],
  blackbeans: [{ food: 'lentils' }],
  chickpeas: [{ food: 'lentils' }],
};

const without = (items: Item[], i: number) => items.filter((_, n) => n !== i);
const replaced = (items: Item[], i: number, item: Item) => items.map((it, n) => (n === i ? item : it));

function changes(items: Item[]): Change[] {
  const out: Change[] = [];
  items.forEach((item, i) => {
    const food = FOODS[item.food];
    // Smaller portions of a carb.
    if (CARB_GROUPS.includes(food.group)) {
      for (let s = item.servings - 0.5; s >= 0.5; s -= 0.5) {
        out.push({
          text: `Use ${amount(item.food, s)} ${name(item.food)} instead of ${amount(item.food, item.servings)}`,
          apply: (xs) => replaced(xs, i, { food: item.food, servings: s }),
        });
      }
      out.push({ text: `Leave out the ${name(item.food)}`, apply: (xs) => without(xs, i) });
    }
    for (const swap of STARCH_SWAPS[item.food] ?? []) {
      out.push({ text: `Use ${swap.text} instead of ${name(item.food)}`, apply: (xs) => replaced(xs, i, { food: swap.food, servings: Math.max(1, item.servings) }) });
    }
    // Yolks, cholesterol, saturated fat.
    if (item.food === 'egg') {
      out.push({ text: 'Use egg whites instead of the whole egg', apply: (xs) => replaced(xs, i, { food: 'eggwhite', servings: item.servings }) });
    }
    if (food.satFat >= 1 && item.servings > 0.5) {
      out.push({ text: `Use half as much ${name(item.food)}`, apply: (xs) => replaced(xs, i, { food: item.food, servings: item.servings / 2 }) });
    }
    if (item.food === 'pb') out.push({ text: 'Use 6 almonds instead of peanut butter', apply: (xs) => replaced(xs, i, { food: 'almonds', servings: 1 }) });
    // Sodium.
    if (item.food === 'lssoy') {
      if (item.servings > 0.5) out.push({ text: 'Use half the soy sauce', apply: (xs) => replaced(xs, i, { food: 'lssoy', servings: item.servings / 2 }) });
      out.push({ text: 'Leave out the soy sauce; use lemon and garlic', apply: (xs) => without(xs, i) });
    }
    for (const swap of SALT_SWAPS[item.food] ?? []) {
      out.push({ text: `Use ${name(swap.food)} instead of ${name(item.food)}`, apply: (xs) => replaced(xs, i, { food: swap.food, servings: item.servings }) });
    }
  });
  for (const p of PAIRINGS) {
    if (items.some((it) => it.food === p.food)) continue;
    out.push({ text: p.text, apply: (xs) => [...xs, { food: p.food, servings: p.servings }] });
  }
  return out;
}

const key = (items: Item[]) => items.map((i) => `${i.food}:${i.servings}`).sort().join(',');

export function makeItFit(items: Item[], type: MealType, rules: Rules, context: Context, limit = 3): Fix[] {
  const start = items.map(({ food, servings }) => ({ food, servings }));
  if (evaluate(start, type, rules, context).fits) return [];
  const seen = new Set([key(start)]);
  const fits: Fix[] = [];
  const singles = changes(start);
  const tryFix = (text: string, next: Item[]) => {
    if (!next.length) return;
    const k = key(next);
    if (seen.has(k)) return;
    seen.add(k);
    if (evaluate(next, type, rules, context).fits) fits.push({ text, items: next });
  };
  for (const c of singles) tryFix(c.text, c.apply(start));
  if (fits.length < limit) {
    for (let a = 0; a < singles.length && fits.length < limit; a++) {
      const first = singles[a].apply(start);
      for (const c of changes(first)) {
        if (fits.length >= limit) break;
        tryFix(`${singles[a].text}, and ${c.text.charAt(0).toLowerCase()}${c.text.slice(1)}`, c.apply(first));
      }
    }
  }
  return fits.slice(0, limit);
}
