/**
 * What a person never has - "Never use" on the Plan screen - and caffeine.
 *
 * Hard, not a preference: a meal with an avoided food is never suggested,
 * planned, offered as an alternative, built or proposed by chat. Where the
 * avoided food is only a side (mushrooms in a stir-fry, olives on a salad),
 * the recipe swaps it for a similar food from the same group and says so;
 * where it is the point of the dish (salmon), the recipe is not offered.
 *
 * Caffeine has no food in the table, so no recipe can contain it; the rule
 * keeps chat from suggesting a cup of coffee or tea alongside.
 */

import type { Meal } from './catalog';
import { FOODS, shortName } from './foods';
import type { Item } from './rules';

export interface Restrictions {
  /** Ids from AVOID_OPTIONS. */
  avoid: string[];
  noCaffeine: boolean;
}

export const NO_RESTRICTIONS: Restrictions = { avoid: [], noCaffeine: false };

export const AVOID_OPTIONS: Array<{ id: string; label: string; foods: string[] }> = [
  { id: 'fish', label: 'Fish', foods: ['salmon', 'cod', 'tilapia', 'tuna'] },
  { id: 'shellfish', label: 'Shellfish', foods: ['shrimp'] },
  { id: 'mushrooms', label: 'Fresh mushrooms', foods: ['mushrooms'] },
  { id: 'olives', label: 'Olives', foods: ['olives'] },
  { id: 'eggs', label: 'Eggs', foods: ['egg', 'eggwhite'] },
  { id: 'peanuts', label: 'Peanuts', foods: ['pb'] },
  { id: 'treenuts', label: 'Tree nuts', foods: ['almonds', 'walnuts', 'pecans', 'cashews', 'pistachios'] },
  { id: 'pork', label: 'Pork', foods: ['pork'] },
  { id: 'beef', label: 'Beef', foods: ['sirloin'] },
  { id: 'soy', label: 'Soy', foods: ['tofu', 'tempeh', 'edamame', 'soymilk', 'lssoy'] },
];

export const avoidLabel = (id: string) => AVOID_OPTIONS.find((o) => o.id === id)?.label ?? id;

export function avoidedFoods(r: Restrictions): Set<string> {
  return new Set(AVOID_OPTIONS.filter((o) => r.avoid.includes(o.id)).flatMap((o) => o.foods));
}

/** Stand-ins for a side ingredient, in order of preference, by food group. */
const STAND_INS: Record<string, string[]> = {
  veg: ['zucchini', 'greenbeans', 'peppers', 'broccoli', 'spinach', 'snowpeas'],
  fat: ['avocado', 'almonds', 'walnuts', 'oliveoil', 'seeds'],
};

/** Which option rules a food out ("fish"), or null. */
function optionFor(food: string, r: Restrictions): string | null {
  return AVOID_OPTIONS.find((o) => r.avoid.includes(o.id) && o.foods.includes(food))?.id ?? null;
}

const name = (id: string) => shortName(FOODS[id]).toLowerCase();

/**
 * The meal as she can have it: unchanged, with side ingredients swapped (and
 * a note saying so), or null when what she avoids is the heart of the dish.
 */
export function adaptMeal(meal: Meal, r: Restrictions): Meal | null {
  const avoided = avoidedFoods(r);
  if (!meal.items.some((i) => avoided.has(i.food))) return meal;
  let items: Item[] = meal.items.map((i) => ({ ...i }));
  let steps = [...meal.steps];
  let title = meal.name;
  const notes: string[] = [];
  for (const item of meal.items.filter((i) => avoided.has(i.food))) {
    const group = FOODS[item.food].group;
    const stand = (STAND_INS[group] ?? []).find((f) => !avoided.has(f) && !meal.items.some((x) => x.food === f));
    if (!stand) return null;
    const from = name(item.food);
    const to = name(stand);
    items = items.map((i) => (i.food === item.food ? { food: stand, servings: i.servings } : i));
    const swapWord = (t: string) => t.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
    steps = steps.map(swapWord);
    title = swapWord(title);
    notes.push(`Made without ${from}: ${to} instead.`);
  }
  return { ...meal, name: title, items, steps, note: [meal.note, ...notes].filter(Boolean).join(' ') };
}

/** The meals she can have, adapted, in the same order. */
export function adaptMeals(meals: Meal[], r: Restrictions): Meal[] {
  return meals.map((m) => adaptMeal(m, r)).filter((m): m is Meal => m !== null);
}

/** Why a meal is ruled out ("has fish"), or null if she can have it as it is or adapted. */
export function ruledOut(meal: Meal, r: Restrictions): string | null {
  if (adaptMeal(meal, r)) return null;
  const option = meal.items.map((i) => optionFor(i.food, r)).find(Boolean);
  return option ? `has ${avoidLabel(option).toLowerCase()}` : 'has something she avoids';
}

/** An item list with something she avoids in it, by option label - for built and chat recipes. */
export function avoidedIn(items: Item[], r: Restrictions): string | null {
  const option = items.map((i) => optionFor(i.food, r)).find(Boolean);
  return option ? avoidLabel(option) : null;
}

/** Coffee, black or green tea, cola, energy drinks, chocolate - not decaf or herbal tea. */
const CAFFEINE = /\b(coffee|espresso|latte|cappuccino|americano|mocha|black tea|green tea|chai|matcha|oolong|earl grey|yerba mate|cola|energy drinks?|chocolate|cocoa|cacao)\b/i;
const CAFFEINE_FREE = /\b(decaf|decaffeinated|caffeine[- ]free|herbal|rooibos|chamomile|peppermint tea|ginger tea)\b/i;

export const mentionsCaffeine = (text: string) => CAFFEINE.test(text) && !CAFFEINE_FREE.test(text);

/** Text with any sentence that offers caffeine taken out. */
export function withoutCaffeine(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  return sentences.filter((s) => !mentionsCaffeine(s)).join('').trim();
}

export function cleanRestrictions(input: unknown): Restrictions | null {
  const r = input as { avoid?: unknown; noCaffeine?: unknown };
  if (!r || typeof r !== 'object' || !Array.isArray(r.avoid) || typeof r.noCaffeine !== 'boolean') return null;
  const ids = AVOID_OPTIONS.map((o) => o.id);
  if (!r.avoid.every((a): a is string => typeof a === 'string' && ids.includes(a))) return null;
  return { avoid: [...new Set(r.avoid as string[])], noCaffeine: r.noCaffeine };
}
