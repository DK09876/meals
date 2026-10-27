import { describe, expect, it } from 'vitest';

import { fraction, itemLabel } from './format';

describe('fraction', () => {
  it('reads like a recipe', () => {
    expect([0, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2].map(fraction)).toEqual(['0', '¼', '⅓', '½', '⅔', '¾', '1', '1½', '2']);
  });
});

describe('itemLabel', () => {
  it("keeps a recipe's own words, and spells out a built item", () => {
    expect(itemLabel({ food: 'oats', servings: 1, label: '½ cup oatmeal' })).toBe('½ cup oatmeal');
    expect(itemLabel({ food: 'oats', servings: 1 })).toBe('Oatmeal · ½ cup cooked');
    expect(itemLabel({ food: 'oats', servings: 1.5 })).toBe('Oatmeal · 1½ × ½ cup cooked');
  });
});
