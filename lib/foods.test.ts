import { describe, expect, it } from 'vitest';

import { FOODS } from './foods';
import usda from './foods-usda.json';

describe('the food table', () => {
  it('has the USDA foods, traced to their USDA ids', () => {
    expect(Object.keys(FOODS).length).toBeGreaterThan(110);
    for (const id of Object.keys(usda)) expect(FOODS[id].fdcId, id).toBeGreaterThan(0);
  });

  it('counts every non-starchy vegetable at 5 g of carbs, as her handout does', () => {
    for (const f of Object.values(FOODS).filter((x) => x.group === 'veg')) expect(f.carbs, f.id).toBe(5);
  });

  it('has sane numbers', () => {
    for (const f of Object.values(FOODS)) {
      for (const k of ['carbs', 'protein', 'fat', 'satFat', 'sodium', 'cholesterol'] as const) expect(f[k], `${f.id}.${k}`).toBeGreaterThanOrEqual(0);
      expect(f.satFat, f.id).toBeLessThanOrEqual(f.fat + 0.05);
    }
  });

  it('leaves out what her cholesterol handout says to limit', () => {
    const names = Object.values(FOODS).map((f) => f.name.toLowerCase()).join(' | ');
    for (const banned of ['bacon', 'sausage', 'salami', 'bologna', 'liver', 'fried', 'cream cheese', 'cheddar', 'hot dog', 'coconut']) expect(names).not.toContain(banned);
    // Butter itself (peanut butter is a healthy fat on her handout).
    expect(Object.values(FOODS).filter((f) => /^butter\b/i.test(f.name))).toEqual([]);
  });
});
