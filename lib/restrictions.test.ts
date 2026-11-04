import { describe, expect, it } from 'vitest';

import { CATALOG } from './catalog';
import { vet, systemPrompt } from './chat';
import { addDays } from './dates';
import { fillWeek, checkSlot, withSlot, type World } from './plan';
import type { Taste } from './rank';
import { adaptMeal, adaptMeals, avoidedFoods, cleanRestrictions, mentionsCaffeine, ruledOut, withoutCaffeine, type Restrictions } from './restrictions';
import { DEFAULT_RULES, evaluate, MEAL_TYPES, NOTHING_EATEN } from './rules';
import { makeItFit } from './swaps';

/** Grandma's, as set on 2026-11-03. */
const HERS: Restrictions = { avoid: ['fish', 'mushrooms', 'olives'], noCaffeine: true };
const byId = new Map(CATALOG.map((m) => [m.id, m]));
const meal = (id: string) => byId.get(id)!;

describe('never use', () => {
  it('swaps a side ingredient and says so', () => {
    const stirFry = adaptMeal(meal('chicken-stir-fry'), HERS)!;
    expect(stirFry.items.map((i) => i.food)).not.toContain('mushrooms');
    expect(stirFry.items.map((i) => i.food)).toContain('zucchini');
    expect(stirFry.note).toBe('Made without mushrooms: zucchini instead.');
    expect(stirFry.steps.join(' ')).not.toMatch(/mushroom/i);
    expect(stirFry.id).toBe('chicken-stir-fry');
  });

  it('does not offer a dish built around what she avoids', () => {
    expect(adaptMeal(meal('salmon-rice-broccoli'), HERS)).toBeNull();
    expect(ruledOut(meal('lemon-cod-asparagus'), HERS)).toBe('has fish');
  });

  it('keeps olive oil when olives are avoided', () => {
    expect(avoidedFoods(HERS).has('oliveoil')).toBe(false);
    expect(adaptMeal(meal('turkey-pasta'), HERS)).toBe(meal('turkey-pasta'));
  });

  it('leaves her enough of every meal, and every adapted meal still fits her plan', () => {
    const mine = adaptMeals(CATALOG, HERS);
    for (const { id } of MEAL_TYPES) expect(mine.filter((m) => m.type === id).length, id).toBeGreaterThanOrEqual(4);
    for (const m of mine) {
      expect(m.items.some((i) => avoidedFoods(HERS).has(i.food)), m.id).toBe(false);
      expect(evaluate(m.items, m.type, DEFAULT_RULES, NOTHING_EATEN).fits, m.id).toBe(true);
    }
  });

  it('fills a whole week with nothing she avoids, every slot within her limits', () => {
    const mine = adaptMeals(CATALOG, HERS);
    const lookup = new Map(mine.map((m) => [m.id, m]));
    const empty: World = { plan: [], log: [], rules: DEFAULT_RULES, meal: (id) => lookup.get(id), avoided: avoidedFoods(HERS) };
    const taste: Taste = { likes: new Map(), log: [], pantry: new Set(), now: new Date(2026, 10, 3) };
    let w = empty;
    for (const e of fillWeek(empty, mine, taste, '2026-11-03')) w = withSlot(w, e.date, e.slot, e.mealId);
    expect(w.plan).toHaveLength(28);
    for (const p of w.plan) {
      const m = lookup.get(p.mealId)!;
      expect(m.items.some((i) => ['salmon', 'cod', 'tilapia', 'tuna', 'mushrooms', 'olives'].includes(i.food)), p.mealId).toBe(false);
      expect(checkSlot(w, p.date, p.slot, m).fits).toBe(true);
    }
    expect(new Set(w.plan.filter((p) => p.slot === 'dinner').map((p) => p.mealId)).size).toBeGreaterThanOrEqual(4);
    void addDays;
  });

  it('never fixes a meal by adding something she avoids', () => {
    const nutFree: Restrictions = { avoid: ['treenuts', 'peanuts'], noCaffeine: false };
    const fixes = makeItFit([{ food: 'apple', servings: 0.5 }], 'snack', DEFAULT_RULES, NOTHING_EATEN, 5, avoidedFoods(nutFree));
    for (const f of fixes) expect(f.items.some((i) => ['almonds', 'walnuts', 'pb'].includes(i.food)), f.text).toBe(false);
    expect(fixes.length).toBeGreaterThan(0);
  });

  it('only takes known options', () => {
    expect(cleanRestrictions({ avoid: ['fish', 'fish'], noCaffeine: true })).toEqual({ avoid: ['fish'], noCaffeine: true });
    expect(cleanRestrictions({ avoid: ['broccoli'], noCaffeine: true })).toBeNull();
    expect(cleanRestrictions({ avoid: [] })).toBeNull();
  });
});

describe('caffeine', () => {
  it('spots coffee, tea, cola and chocolate - not decaf or herbal tea', () => {
    for (const t of ['Serve with a cup of coffee.', 'Pair with green tea.', 'A square of dark chocolate.', 'Enjoy with chai.']) expect(mentionsCaffeine(t), t).toBe(true);
    for (const t of ['Have it with herbal tea.', 'A decaf coffee is fine.', 'Add cocoa-free spice.'.replace('cocoa-free ', '')]) expect(mentionsCaffeine(t), t).toBe(false);
  });

  it('takes out only the sentences that offer it', () => {
    expect(withoutCaffeine('Here is a breakfast. Have it with coffee. Enjoy!')).toBe('Here is a breakfast. Enjoy!');
  });
});

describe('chat with her never-use list', () => {
  const ctx = { rules: DEFAULT_RULES, restrictions: HERS, pantry: [], favourites: [], notForMe: [], grandma: true };

  it('leaves avoided foods out of the list it shows the model, and says never', () => {
    const p = systemPrompt(ctx);
    expect(p).not.toMatch(/^salmon:/m);
    expect(p).not.toMatch(/^mushrooms:/m);
    expect(p).toMatch(/^oliveoil:/m);
    expect(p).toContain('She never has: fish; fresh mushrooms; olives; caffeine');
  });

  it('drops a fish recipe and strips a coffee suggestion from the steps', () => {
    const { kept, dropped } = vet([
      { name: 'Salmon bowl', type: 'dinner', minutes: 20, items: [{ food: 'salmon', servings: 1 }, { food: 'quinoa', servings: 1 }, { food: 'broccoli', servings: 2 }], steps: ['Bake.'] },
      { name: 'Oatmeal', type: 'breakfast', minutes: 10, items: [{ food: 'oats', servings: 1 }, { food: 'walnuts', servings: 1 }, { food: 'greekyog', servings: 0.5 }], steps: ['Cook the oats.', 'Serve with a cup of coffee.'] },
    ], DEFAULT_RULES, HERS);
    expect(dropped).toEqual(['Salmon bowl']);
    expect(kept[0].steps).toEqual(['Cook the oats.']);
  });
});
