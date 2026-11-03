import { describe, expect, it } from 'vitest';

import { CATALOG } from './catalog';
import { addDays } from './dates';
import { alternatives, checkSlot, fillWeek, slotContext, withSlot, type World } from './plan';
import { ranked, type Taste } from './rank';
import { DEFAULT_RULES, MEAL_TYPES } from './rules';

const byId = new Map(CATALOG.map((m) => [m.id, m]));
const empty: World = { plan: [], log: [], rules: DEFAULT_RULES, meal: (id) => byId.get(id) };
const taste: Taste = { likes: new Map(), log: [], pantry: new Set(), now: new Date(2026, 10, 2) };
const start = '2026-11-02';

describe('slotContext', () => {
  it('adds up the rest of the day, leaving the slot itself out', () => {
    let w = withSlot(empty, start, 'breakfast', 'veggie-omelet'); // 186 mg
    w = withSlot(w, start, 'dinner', 'salmon-rice-broccoli'); // 54 mg
    expect(Math.round(slotContext(w, start, 'lunch').cholesterolToday)).toBe(240);
    expect(Math.round(slotContext(w, start, 'breakfast').cholesterolToday)).toBe(54);
  });

  it('counts egg yolks over every seven days in a row that include the day', () => {
    let w = withSlot(empty, start, 'breakfast', 'veggie-omelet');
    w = withSlot(w, addDays(start, 6), 'breakfast', 'veggie-omelet');
    // Day 7 shares a window with day 6 but not with day 0.
    expect(slotContext(w, addDays(start, 7), 'breakfast').yolksThisWeek).toBe(1);
    expect(slotContext(w, addDays(start, 3), 'breakfast').yolksThisWeek).toBe(2);
  });

  it('counts what she ate where nothing is planned', () => {
    const w: World = { ...empty, log: [{ id: 'x', mealId: 'veggie-omelet', name: '', type: 'breakfast', items: byId.get('veggie-omelet')!.items, eatenAt: new Date(2026, 10, 2, 8).toISOString() }] };
    expect(checkSlot(w, start, 'lunch', byId.get('turkey-avocado-wrap')!).fits).toBe(false); // 186 + 40 > 200
  });
});

describe('fillWeek', () => {
  const filled = () => {
    let w = empty;
    for (const e of fillWeek(empty, CATALOG, taste, start)) w = withSlot(w, e.date, e.slot, e.mealId);
    return w;
  };

  it('fills every slot it can, and every meal fits with all the others', () => {
    const w = filled();
    expect(w.plan).toHaveLength(28);
    for (const p of w.plan) expect(checkSlot(w, p.date, p.slot, byId.get(p.mealId)!).fits, `${p.date} ${p.slot} ${p.mealId}`).toBe(true);
  });

  it('varies the week rather than repeating one meal', () => {
    const w = filled();
    for (const { id } of MEAL_TYPES) {
      const used = new Set(w.plan.filter((p) => p.slot === id).map((p) => p.mealId));
      expect(used.size, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('never picks a meal marked "not for me", and leans on favourites', () => {
    const t: Taste = { ...taste, likes: new Map([['yogurt-berry-bowl', 1], ['berry-oatmeal', -1]]) };
    const added = fillWeek(empty, CATALOG, t, start);
    const breakfasts = added.filter((e) => e.slot === 'breakfast').map((e) => e.mealId);
    expect(breakfasts).not.toContain('berry-oatmeal');
    expect(breakfasts[0]).toBe('yogurt-berry-bowl');
  });
});

describe('alternatives', () => {
  it('offers meals that fit the slot, and days where the pick fits', () => {
    let w = empty;
    for (const d of [0, 1, 2]) w = withSlot(w, addDays(start, d), 'breakfast', 'veggie-omelet');
    const alt = alternatives(w, CATALOG, taste, addDays(start, 3), 'breakfast', byId.get('veggie-omelet')!, start);
    expect(alt.instead.length).toBe(3);
    for (const m of alt.instead) expect(checkSlot(w, addDays(start, 3), 'breakfast', m).fits).toBe(true);
    // Every other day in the week is still within a 7-day window of three omelets.
    expect(alt.otherDays).toEqual([]);
  });
});

describe('alternatives, with the slot already planned', () => {
  it('never offers what the slot already has', () => {
    let w = withSlot(empty, start, 'breakfast', 'berry-oatmeal');
    w = withSlot(w, start, 'dinner', 'salmon-rice-broccoli');
    w = withSlot(w, start, 'lunch', 'chicken-quinoa-salad');
    const alt = alternatives(w, CATALOG, taste, start, 'breakfast', byId.get('veggie-omelet')!, start);
    expect(alt.instead.map((m) => m.id)).not.toContain('berry-oatmeal');
  });
});

describe('ranked', () => {
  it('puts favourites first, hides "not for me", and sinks yesterday\'s meal', () => {
    const lunches = CATALOG.filter((m) => m.type === 'lunch');
    const t: Taste = {
      ...taste,
      likes: new Map([['chicken-quinoa-salad', 1], ['lentil-spinach-soup', -1]]),
      log: [{ id: 'x', mealId: 'turkey-avocado-wrap', name: '', type: 'lunch', items: [], eatenAt: new Date(2026, 10, 1, 12).toISOString() }],
    };
    expect(ranked(lunches, t).map((m) => m.id)).toEqual(['chicken-quinoa-salad', 'chicken-veg-pasta-soup', 'turkey-avocado-wrap']);
  });
});
