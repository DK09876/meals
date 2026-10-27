/**
 * Her plan, as checks a meal either passes or fails.
 *
 * Where each rule comes from:
 * - Carbs per meal (35 g), and "a carb always comes with a protein or fat":
 *   her care team.
 * - Cholesterol under 200 mg a day, and 2-4 egg yolks a week: her LDL handout.
 * - Unlimited non-starchy veggies (counted at 5 g each, see foods.ts), half
 *   the plate at lunch and dinner: her diabetes handouts.
 * - Carbs per snack, sodium and saturated fat per meal: assumptions, since
 *   her papers say only "low sodium" and "limit saturated fat". The Plan
 *   screen labels them "please confirm" and lets the family change them.
 *
 * Where her diabetes and cholesterol handouts disagree (bacon and butter are
 * on the diabetes fat list), the stricter one wins: those foods are simply not
 * in the food table.
 *
 * A check is "situational" when it depends on what else she has eaten -
 * today's cholesterol, this week's egg yolks. A saved meal can fail one of
 * those today and fit again tomorrow; the others are about the meal itself.
 */

import { FOODS } from './foods';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: Array<{ id: MealType; label: string }> = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
];

export const isMealType = (value: unknown): value is MealType => MEAL_TYPES.some((t) => t.id === value);
export const mealTypeLabel = (type: MealType) => MEAL_TYPES.find((t) => t.id === type)!.label;

export interface Rules {
  carbMeal: number;
  carbSnack: number;
  sodiumMeal: number;
  satFatMeal: number;
  cholesterolDay: number;
  yolksWeek: number;
}

export const DEFAULT_RULES: Rules = {
  carbMeal: 35,
  carbSnack: 15,
  sodiumMeal: 600,
  satFatMeal: 4,
  cholesterolDay: 200,
  yolksWeek: 3,
};

/** How each rule can be changed on the Plan screen, and what the server accepts. */
export const RULE_SETTINGS: Record<keyof Rules, { label: string; unit: string; step: number; min: number; max: number; source: string; confirmed: boolean }> = {
  carbMeal: { label: 'Carbs per meal', unit: 'g', step: 5, min: 15, max: 75, source: 'Her care team', confirmed: true },
  carbSnack: { label: 'Carbs per snack', unit: 'g', step: 5, min: 5, max: 30, source: 'Guess · please confirm', confirmed: false },
  sodiumMeal: { label: 'Sodium per meal', unit: 'mg', step: 50, min: 300, max: 1200, source: 'Guess · please confirm', confirmed: false },
  satFatMeal: { label: 'Saturated fat per meal', unit: 'g', step: 1, min: 1, max: 10, source: 'Guess · please confirm', confirmed: false },
  cholesterolDay: { label: 'Cholesterol per day', unit: 'mg', step: 25, min: 100, max: 300, source: 'Her handout', confirmed: true },
  yolksWeek: { label: 'Egg yolks per week', unit: '', step: 1, min: 0, max: 7, source: 'Her handout: 2 to 4', confirmed: true },
};

export const RULE_KEYS = Object.keys(DEFAULT_RULES) as Array<keyof Rules>;

/** A rules change from a client, kept to known keys and the allowed ranges; null if anything is off. */
export function cleanRuleChanges(input: unknown): Partial<Rules> | null {
  if (!input || typeof input !== 'object') return null;
  const out: Partial<Rules> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!RULE_KEYS.includes(key as keyof Rules)) return null;
    const setting = RULE_SETTINGS[key as keyof Rules];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < setting.min || value > setting.max) return null;
    out[key as keyof Rules] = value;
  }
  return Object.keys(out).length ? out : null;
}

export interface Item {
  food: string;
  /** In servings of the food table's serving size; halves allowed. */
  servings: number;
  /** How a recipe says it ("½ cup cooked oatmeal, no salt"). Built meals leave it out. */
  label?: string;
}

export interface Totals {
  carbs: number;
  protein: number;
  fat: number;
  satFat: number;
  sodium: number;
  cholesterol: number;
  yolks: number;
  /** Servings of non-starchy veg - two fill half a plate. */
  vegServings: number;
  /** Carbs from grains, fruit and milk: the ones that need pairing. Veggies and nuts don't count. */
  pairedCarbs: number;
}

export function totals(items: Item[]): Totals {
  const t: Totals = { carbs: 0, protein: 0, fat: 0, satFat: 0, sodium: 0, cholesterol: 0, yolks: 0, vegServings: 0, pairedCarbs: 0 };
  for (const { food: id, servings } of items) {
    const food = FOODS[id];
    if (!food) throw new Error(`Unknown food: ${id}`);
    t.carbs += food.carbs * servings;
    t.protein += food.protein * servings;
    t.fat += food.fat * servings;
    t.satFat += food.satFat * servings;
    t.sodium += food.sodium * servings;
    t.cholesterol += food.cholesterol * servings;
    t.yolks += (food.yolks ?? 0) * servings;
    if (food.group === 'veg') t.vegServings += servings;
    if (food.group === 'starch' || food.group === 'fruit' || food.group === 'milk') t.pairedCarbs += food.carbs * servings;
  }
  return t;
}

/** What she has already had, for the checks that depend on it. */
export interface Context {
  cholesterolToday: number;
  yolksThisWeek: number;
}

export const NOTHING_EATEN: Context = { cholesterolToday: 0, yolksThisWeek: 0 };

export type Status = 'ok' | 'warn' | 'fail';
export type CheckKind = 'carbs' | 'pairing' | 'sodium' | 'satFat' | 'veg' | 'yolks' | 'cholesterol';

export interface Check {
  kind: CheckKind;
  status: Status;
  text: string;
  situational: boolean;
}

export interface Limits {
  carbs: number;
  sodium: number;
  satFat: number;
}

/** A snack gets its own carb limit, and half a meal's sodium and saturated fat. */
export function limitsFor(type: MealType, rules: Rules): Limits {
  const snack = type === 'snack';
  return {
    carbs: snack ? rules.carbSnack : rules.carbMeal,
    sodium: snack ? rules.sodiumMeal / 2 : rules.sodiumMeal,
    satFat: snack ? rules.satFatMeal / 2 : rules.satFatMeal,
  };
}

/**
 * A carb counts as paired when the meal has a real serving of protein or
 * fat beside it - 5 g of protein (an egg's worth) or 4 g of fat (a teaspoon
 * of oil, six almonds). A slice of toast's own 4 g of protein is not a pairing.
 */
export const PAIRING = { protein: 5, fat: 4 };

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface Evaluation {
  totals: Totals;
  limits: Limits;
  checks: Check[];
  verdict: { status: Status; text: string };
  /** Passes every check right now. */
  fits: boolean;
  /** Fails nothing about the meal itself - may still be over today's cholesterol or this week's yolks. */
  fitsAnyDay: boolean;
}

/**
 * Every check for one meal. Numbers are compared as they are shown - whole
 * grams and milligrams, saturated fat to a tenth - so a meal shown as "35 g"
 * never fails a 35 g limit.
 */
export function evaluate(items: Item[], type: MealType, rules: Rules, context: Context = NOTHING_EATEN): Evaluation {
  const t = totals(items);
  const limits = limitsFor(type, rules);
  const checks: Check[] = [];
  const carbs = round(t.carbs);

  checks.push(carbs <= limits.carbs
    ? { kind: 'carbs', status: 'ok', text: `Carbs ${carbs} of ${limits.carbs} g`, situational: false }
    : { kind: 'carbs', status: 'fail', text: `${carbs - limits.carbs} g over her carb limit`, situational: false });

  if (t.pairedCarbs > 0) {
    const paired = t.protein >= PAIRING.protein || t.fat >= PAIRING.fat;
    checks.push(paired
      ? { kind: 'pairing', status: 'ok', text: 'Carbs paired', situational: false }
      : { kind: 'pairing', status: 'fail', text: 'Needs a protein or fat', situational: false });
  }

  const sodium = round(t.sodium);
  checks.push(sodium <= limits.sodium
    ? { kind: 'sodium', status: 'ok', text: `Sodium ${sodium} mg`, situational: false }
    : { kind: 'sodium', status: 'fail', text: `Sodium ${sodium} mg, too salty`, situational: false });

  // Saturated fat is a soft limit: her handout says "limit", not "never".
  const satFat = round1(t.satFat);
  checks.push(satFat <= limits.satFat
    ? { kind: 'satFat', status: 'ok', text: `Sat. fat ${satFat} g`, situational: false }
    : { kind: 'satFat', status: 'warn', text: `Sat. fat ${satFat} g, a bit high`, situational: false });

  // The plate method: half the plate veggies at lunch and dinner. Breakfast's
  // half can be empty or fruit, and a snack has no plate. A tip, not a rule.
  if (type === 'lunch' || type === 'dinner') {
    checks.push(t.vegServings >= 2
      ? { kind: 'veg', status: 'ok', text: 'Half plate veggies', situational: false }
      : { kind: 'veg', status: 'warn', text: 'Add veggies to fill half the plate', situational: false });
  }

  if (t.yolks > 0) {
    const week = round(context.yolksThisWeek + t.yolks);
    checks.push(week <= rules.yolksWeek
      ? { kind: 'yolks', status: 'ok', text: `Egg yolk ${week} of ${rules.yolksWeek} this week`, situational: true }
      : { kind: 'yolks', status: 'fail', text: 'Over her egg yolks this week', situational: true });
  }

  // Only worth a chip when the meal brings real cholesterol of its own.
  if (t.cholesterol >= 20) {
    const day = round(context.cholesterolToday + t.cholesterol);
    checks.push(day <= rules.cholesterolDay
      ? { kind: 'cholesterol', status: 'ok', text: `Cholesterol ${day} of ${rules.cholesterolDay} mg today`, situational: true }
      : { kind: 'cholesterol', status: 'fail', text: 'Over her cholesterol for today', situational: true });
  }

  const fails = checks.filter((c) => c.status === 'fail');
  const warns = checks.filter((c) => c.status === 'warn');
  const verdict: Evaluation['verdict'] =
    carbs > limits.carbs ? { status: 'fail', text: `Too many carbs: ${carbs - limits.carbs} g over` }
    : fails.length ? { status: 'fail', text: `Doesn't fit: ${fails[0].text.toLowerCase()}` }
    : warns.length ? { status: 'warn', text: 'Fits her plan, with one tip' }
    : { status: 'ok', text: 'Fits her plan' };

  return {
    totals: t,
    limits,
    checks,
    verdict,
    fits: fails.length === 0,
    fitsAnyDay: !fails.some((c) => !c.situational),
  };
}
