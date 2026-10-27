import { describe, expect, it } from 'vitest';

import { CATALOG } from './catalog';
import type { LogEntry } from './history';
import { DEFAULT_RULES, NOTHING_EATEN } from './rules';
import { ideas, mealTypeAt, missingItems } from './suggest';

const now = new Date(2026, 9, 27, 12, 0);
const base = { rules: DEFAULT_RULES, context: NOTHING_EATEN, pantry: new Set<string>(), useHome: false, log: [] as LogEntry[], now };
const ids = (list: ReturnType<typeof ideas>) => list.map((i) => i.meal.id);

describe('ideas', () => {
  it('offers only meals of the type asked for, in catalog order', () => {
    expect(ids(ideas(CATALOG, { ...base, type: 'lunch' }))).toEqual(['turkey-avocado-wrap', 'lentil-spinach-soup', 'chicken-quinoa-salad', 'chicken-veg-pasta-soup']);
  });

  it('drops a meal that would go over this week\'s egg yolks', () => {
    const list = ids(ideas(CATALOG, { ...base, type: 'breakfast', context: { ...NOTHING_EATEN, yolksThisWeek: 3 } }));
    expect(list).not.toContain('veggie-omelet');
    expect(list.length).toBeGreaterThan(0);
  });

  it('drops everything when her limits are tighter than every meal', () => {
    expect(ideas(CATALOG, { ...base, type: 'lunch', rules: { ...DEFAULT_RULES, carbMeal: 15 } })).toEqual([]);
  });

  it('puts what can be made from home first when asked', () => {
    const pantry = new Set(['lentils', 'carrots', 'spinach', 'oliveoil', 'greekyog']);
    const list = ideas(CATALOG, { ...base, type: 'lunch', pantry, useHome: true });
    expect(list[0].meal.id).toBe('lentil-spinach-soup');
    expect(list[0].missing).toEqual([]);
  });

  it('moves what she had yesterday to the back', () => {
    const log: LogEntry[] = [{ id: 'x', mealId: 'turkey-avocado-wrap', name: '', type: 'lunch', items: [], eatenAt: new Date(2026, 9, 26, 12).toISOString() }];
    expect(ids(ideas(CATALOG, { ...base, type: 'lunch', log })).at(-1)).toBe('turkey-avocado-wrap');
  });
});

describe('missingItems', () => {
  it('never asks you to buy soy sauce', () => {
    const stirFry = CATALOG.find((m) => m.id === 'chicken-stir-fry')!;
    expect(missingItems(stirFry, new Set()).map((i) => i.food)).not.toContain('lssoy');
  });
});

describe('mealTypeAt', () => {
  it('follows the clock', () => {
    expect(mealTypeAt(new Date(2026, 0, 1, 7))).toBe('breakfast');
    expect(mealTypeAt(new Date(2026, 0, 1, 12))).toBe('lunch');
    expect(mealTypeAt(new Date(2026, 0, 1, 15))).toBe('snack');
    expect(mealTypeAt(new Date(2026, 0, 1, 18))).toBe('dinner');
    expect(mealTypeAt(new Date(2026, 0, 1, 22))).toBe('snack');
  });
});
