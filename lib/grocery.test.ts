import { describe, expect, it } from 'vitest';

import { CATALOG } from './catalog';
import { groceryList, groceryText, instacartLink, isStoreSlug, scaleServing } from './grocery';
import { withSlot, type World } from './plan';
import { DEFAULT_RULES } from './rules';

const byId = new Map(CATALOG.map((m) => [m.id, m]));
const empty: World = { plan: [], log: [], rules: DEFAULT_RULES, meal: (id) => byId.get(id) };
const start = '2026-11-02';

describe('scaleServing', () => {
  it('adds recipe amounts up the way a cook would say them', () => {
    expect(scaleServing('3 oz cooked', 3)).toBe('9 oz cooked');
    expect(scaleServing('½ cup cooked', 3)).toBe('1½ cups cooked');
    expect(scaleServing('⅓ cup cooked', 1.5)).toBe('½ cup cooked');
    expect(scaleServing('1 slice', 4)).toBe('4 slices');
    expect(scaleServing('6 almonds', 2)).toBe('12 almonds');
    expect(scaleServing('2 Tbsp', 2)).toBe('4 Tbsp');
  });
});

describe('groceryList', () => {
  it('adds up the planned meals per food, and marks what is at home', () => {
    let w = withSlot(empty, start, 'dinner', 'chicken-stir-fry');
    w = withSlot(w, '2026-11-03', 'dinner', 'sheet-pan-chicken');
    w = withSlot(w, '2026-11-04', 'lunch', 'chicken-quinoa-salad');
    const { lines, mealCount } = groceryList(w, start, 7, new Set(['oliveoil']));
    expect(mealCount).toBe(3);
    const chicken = lines.find((l) => l.food === 'chicken')!;
    expect(chicken).toMatchObject({ amount: '9 oz cooked', search: 'boneless skinless chicken breast', atHome: false });
    expect(chicken.meals).toHaveLength(3);
    expect(lines.find((l) => l.food === 'oliveoil')!.atHome).toBe(true);
    // Grouped: veggies before protein before grains.
    const groups = lines.map((l) => l.group);
    expect(groups.indexOf('veg')).toBeLessThan(groups.indexOf('protein'));
  });

  it('leaves out what she already ate and days outside the range', () => {
    let w = withSlot(empty, start, 'lunch', 'lentil-spinach-soup');
    w = withSlot(w, '2026-11-20', 'lunch', 'turkey-avocado-wrap');
    w = { ...w, log: [{ id: 'x', mealId: 'lentil-spinach-soup', name: '', type: 'lunch', items: [], eatenAt: new Date(2026, 10, 2, 12).toISOString() }] };
    expect(groceryList(w, start, 7, new Set()).lines).toEqual([]);
  });

  it('asks for the no-salt version by name', () => {
    const w = withSlot(empty, start, 'dinner', 'black-bean-bowl');
    expect(groceryList(w, start, 7, new Set()).lines.find((l) => l.food === 'blackbeans')!.search).toBe('no salt added black beans');
  });

  it('writes a list to share, without what is at home', () => {
    const w = withSlot(empty, start, 'snack', 'apple-pb');
    const text = groceryText(groceryList(w, start, 7, new Set(['pb'])).lines, 'Groceries');
    expect(text).toBe('Groceries\n\n• apple - ½ small');
  });
});

describe('instacartLink', () => {
  it('searches the chosen store, or Instacart as a whole', () => {
    expect(instacartLink('blackbeans', 'costco')).toBe('https://www.instacart.com/store/costco/s?k=no%20salt%20added%20black%20beans');
    expect(instacartLink('oats', '')).toBe('https://www.instacart.com/store/s?k=old%20fashioned%20rolled%20oats');
  });

  it('only takes a plain store slug', () => {
    expect(isStoreSlug('sprouts')).toBe(true);
    expect(isStoreSlug('')).toBe(true);
    expect(isStoreSlug('../x')).toBe(false);
    expect(isStoreSlug('Safeway Store')).toBe(false);
  });
});
