import { describe, expect, it } from 'vitest';

import { CATALOG } from './catalog';
import { FOODS } from './foods';
import { DEFAULT_RULES, evaluate } from './rules';

describe('the built-in meals', () => {
  it.each(CATALOG.map((m) => [m.id, m] as const))('%s fits her plan on a day she has eaten nothing else', (_, meal) => {
    const e = evaluate(meal.items, meal.type, DEFAULT_RULES);
    expect(e.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });

  it('only uses foods from the table', () => {
    for (const meal of CATALOG) for (const item of meal.items) expect(FOODS[item.food], `${meal.id}: ${item.food}`).toBeDefined();
  });

  it('has unique ids and every meal type', () => {
    expect(new Set(CATALOG.map((m) => m.id)).size).toBe(CATALOG.length);
    for (const type of ['breakfast', 'lunch', 'dinner', 'snack']) expect(CATALOG.filter((m) => m.type === type).length).toBeGreaterThanOrEqual(3);
  });

  it('gives every plated meal steps', () => {
    for (const meal of CATALOG.filter((m) => m.type !== 'snack')) expect(meal.steps.length, meal.id).toBeGreaterThan(0);
  });
});
