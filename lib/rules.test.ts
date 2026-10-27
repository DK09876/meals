import { describe, expect, it } from 'vitest';

import { cleanRuleChanges, DEFAULT_RULES, evaluate, limitsFor, NOTHING_EATEN, satFatBudget, totals, type Item } from './rules';

const it_ = (food: string, servings = 1): Item => ({ food, servings });
const kinds = (items: Item[], type: Parameters<typeof evaluate>[1], ctx?: Parameters<typeof evaluate>[3]) =>
  Object.fromEntries(evaluate(items, type, DEFAULT_RULES, ctx).checks.map((c) => [c.kind, c.status]));

describe('totals', () => {
  it('adds up servings, counting veggies by her handout', () => {
    const t = totals([it_('brownrice', 1.5), it_('broccoli'), it_('salmon')]);
    expect(t.carbs).toBeCloseTo(27.5);
    expect(t.vegServings).toBe(1);
    expect(t.pairedCarbs).toBeCloseTo(22.5); // veggies need no pairing
    expect(t.cholesterol).toBe(54);
  });

  it('refuses a food that is not in the table', () => {
    expect(() => totals([it_('bacon')])).toThrow(/Unknown food/);
  });
});

describe('carbs', () => {
  it('passes at exactly the limit, as shown', () => {
    // 20 + 15 = 35
    expect(kinds([it_('lentils'), it_('apple'), it_('chicken')], 'lunch').carbs).toBe('ok');
  });

  it('fails one gram over and says by how much', () => {
    const e = evaluate([it_('lentils'), it_('apple'), it_('wwbread', 0.5), it_('chicken')], 'lunch', DEFAULT_RULES);
    expect(e.verdict).toEqual({ status: 'fail', text: 'Too many carbs: 6 g over' });
    expect(e.fits).toBe(false);
    expect(e.fitsAnyDay).toBe(false);
  });

  it('uses the snack limit for snacks', () => {
    expect(limitsFor('snack', DEFAULT_RULES)).toEqual({ carbs: 15, sodium: 300 });
    expect(kinds([it_('apple'), it_('pb')], 'snack').carbs).toBe('fail'); // 18 g
    expect(kinds([it_('apple', 0.5), it_('pb')], 'snack').carbs).toBe('ok');
  });

  it("follows her plan's sample menu down: ⅔ cup rice plus veggies is over 35", () => {
    expect(kinds([it_('salmon'), it_('brownrice', 2), it_('broccoli'), it_('carrots')], 'dinner').carbs).toBe('fail');
  });
});

describe('pairing', () => {
  it('fails a carb on its own', () => {
    expect(kinds([it_('apple')], 'snack').pairing).toBe('fail');
  });

  it('passes apple with peanut butter, her own example', () => {
    expect(kinds([it_('apple', 0.5), it_('pb')], 'snack').pairing).toBe('ok');
  });

  it("does not count toast's own protein as a pairing", () => {
    expect(kinds([it_('wwbread')], 'breakfast').pairing).toBe('fail');
  });

  it('is not asked of veggies and nuts', () => {
    expect(kinds([it_('carrots'), it_('cucumber')], 'snack').pairing).toBeUndefined();
  });
});

describe('sodium and saturated fat', () => {
  it('fails a salty meal', () => {
    // 4 tsp low-sodium soy is 760 mg
    expect(kinds([it_('chicken'), it_('lssoy', 4), it_('broccoli', 2)], 'dinner').sodium).toBe('fail');
  });

  it('turns her 5% of calories into a daily gram budget', () => {
    expect(satFatBudget(DEFAULT_RULES)).toBe(8.9); // 5% of 1,600 kcal at 9 kcal/g
    expect(satFatBudget({ ...DEFAULT_RULES, calorieDay: 1800 })).toBe(10);
  });

  it("counts saturated fat against the day's budget, not per meal", () => {
    const meal = [it_('egg'), it_('pb'), it_('wwbread')]; // 3.1 g
    const morning = evaluate(meal, 'breakfast', DEFAULT_RULES);
    expect(morning.checks.find((c) => c.kind === 'satFat')).toMatchObject({ status: 'ok', text: 'Sat. fat 3.1 of 8.9 g today' });
    const later = evaluate(meal, 'lunch', DEFAULT_RULES, { ...NOTHING_EATEN, satFatToday: 6 });
    expect(later.checks.find((c) => c.kind === 'satFat')?.status).toBe('fail');
    // Fine to save - it fits again tomorrow.
    expect(later.fitsAnyDay).toBe(true);
  });
});

describe('the plate', () => {
  it('tips toward half veggies at lunch and dinner only', () => {
    expect(kinds([it_('chicken'), it_('quinoa')], 'dinner').veg).toBe('warn');
    expect(kinds([it_('chicken'), it_('quinoa'), it_('greens', 2)], 'dinner').veg).toBe('ok');
    expect(kinds([it_('oats'), it_('greekyog')], 'breakfast').veg).toBeUndefined();
  });

  it('still fits with only a tip', () => {
    const e = evaluate([it_('chicken'), it_('quinoa')], 'dinner', DEFAULT_RULES);
    expect(e.verdict).toEqual({ status: 'warn', text: 'Fits her plan, with one tip' });
    expect(e.fits).toBe(true);
  });
});

describe('what she already ate', () => {
  it('counts egg yolks over the week', () => {
    expect(kinds([it_('egg')], 'breakfast', { ...NOTHING_EATEN, yolksThisWeek: 2 }).yolks).toBe('ok');
    const over = evaluate([it_('egg')], 'breakfast', DEFAULT_RULES, { ...NOTHING_EATEN, yolksThisWeek: 3 });
    expect(over.fits).toBe(false);
    // Fine to keep - it fits again once the week moves on.
    expect(over.fitsAnyDay).toBe(true);
  });

  it("counts cholesterol against today's total", () => {
    expect(kinds([it_('egg')], 'breakfast', { ...NOTHING_EATEN, cholesterolToday: 9 }).cholesterol).toBe('ok'); // 195
    expect(kinds([it_('egg')], 'breakfast', { ...NOTHING_EATEN, cholesterolToday: 20 }).cholesterol).toBe('fail'); // 206
  });
});

describe('cleanRuleChanges', () => {
  it('takes known rules within range', () => {
    expect(cleanRuleChanges({ carbMeal: 30, sodiumMeal: 500 })).toEqual({ carbMeal: 30, sodiumMeal: 500 });
  });

  it('refuses anything else', () => {
    expect(cleanRuleChanges({ carbMeal: 5 })).toBeNull();
    expect(cleanRuleChanges({ carbMeal: '30' })).toBeNull();
    expect(cleanRuleChanges({ sugar: 10 })).toBeNull();
    expect(cleanRuleChanges({})).toBeNull();
    expect(cleanRuleChanges(null)).toBeNull();
  });
});
