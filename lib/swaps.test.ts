import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES, evaluate, NOTHING_EATEN, type Item } from './rules';
import { makeItFit } from './swaps';

const fit = (items: Item[], type: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'dinner', ctx = NOTHING_EATEN) => makeItFit(items, type, DEFAULT_RULES, ctx);

describe('makeItFit', () => {
  it('offers nothing for a meal that already fits', () => {
    expect(fit([{ food: 'chicken', servings: 1 }, { food: 'quinoa', servings: 1 }, { food: 'greens', servings: 2 }])).toEqual([]);
  });

  it('cuts a carb portion to bring the meal under 35 g, smallest change first', () => {
    // her handout's ⅔ cup rice: 30 + 5 + 5 = 40 g
    const fixes = fit([{ food: 'salmon', servings: 1 }, { food: 'brownrice', servings: 2 }, { food: 'broccoli', servings: 1 }, { food: 'carrots', servings: 1 }]);
    expect(fixes[0].text).toBe('Use 1½ × ⅓ cup cooked brown rice instead of 2 × ⅓ cup cooked');
    for (const f of fixes) expect(evaluate(f.items, 'dinner', DEFAULT_RULES).fits).toBe(true);
  });

  it('pairs a lonely carb', () => {
    const fixes = fit([{ food: 'apple', servings: 0.5 }], 'snack');
    expect(fixes.map((f) => f.text)).toContain('Add 6 almonds on the side');
  });

  it('swaps the whole egg when the week is out of yolks', () => {
    const fixes = fit([{ food: 'egg', servings: 1 }, { food: 'wwbread', servings: 1 }, { food: 'oliveoil', servings: 1 }], 'breakfast', { ...NOTHING_EATEN, yolksThisWeek: 3 });
    expect(fixes[0].text).toBe('Use egg whites instead of the whole egg');
  });

  it('lowers sodium', () => {
    const fixes = fit([{ food: 'chicken', servings: 1 }, { food: 'lssoy', servings: 3 }, { food: 'broccoli', servings: 2 }, { food: 'brownrice', servings: 1 }]);
    expect(fixes.length).toBeGreaterThan(0);
    for (const f of fixes) expect(evaluate(f.items, 'dinner', DEFAULT_RULES).fits).toBe(true);
  });

  it('every fix it offers really fits', () => {
    const heavy: Item[] = [{ food: 'tortilla', servings: 2 }, { food: 'blackbeans', servings: 1 }, { food: 'avocado', servings: 1 }];
    for (const f of fit(heavy, 'lunch')) expect(evaluate(f.items, 'lunch', DEFAULT_RULES).fits).toBe(true);
  });
});
