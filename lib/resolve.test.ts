import { describe, expect, it } from 'vitest';

import { CATALOG, type Meal } from './catalog';
import { addDays } from './dates';
import { checkSlot, withSlot, type World } from './plan';
import type { Taste } from './rank';
import { fixesFor, problems } from './resolve';
import { DEFAULT_RULES } from './rules';

const byId = new Map(CATALOG.map((m) => [m.id, m]));
const meal = (id: string) => byId.get(id)!;
const today = '2026-11-02';
const empty: World = { plan: [], log: [], rules: DEFAULT_RULES, meal: (id) => byId.get(id) };
const taste: Taste = { likes: new Map(), log: [], pantry: new Set(), now: new Date(2026, 10, 2, 7) };
const plan = (entries: Array<[string, 'breakfast' | 'lunch' | 'dinner' | 'snack', string]>) =>
  entries.reduce((w, [d, s, id]) => withSlot(w, d, s, id), empty);

/** Apply a fix the way the phone does, and return the plan after it. */
function apply(w: World, date: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snack', picked: Meal, fix: ReturnType<typeof fixesFor>[number]): { world: World; placed: Meal } {
  switch (fix.kind) {
    case 'adjust': {
      const copy: Meal = { ...picked, id: 'adj', items: fix.items };
      return { world: { ...withSlot(w, date, slot, 'adj'), meal: (id) => (id === 'adj' ? copy : byId.get(id)) }, placed: copy };
    }
    case 'swapOther': return { world: withSlot(withSlot(w, fix.date, fix.slot, fix.toMealId), date, slot, picked.id), placed: picked };
    case 'otherDay': return { world: withSlot(w, fix.date, slot, picked.id), placed: picked };
    case 'instead': return { world: withSlot(w, date, slot, fix.mealId), placed: meal(fix.mealId) };
  }
}

describe('fixesFor', () => {
  it('offers changing this recipe, changing tonight, another day, or another meal - for a day over on cholesterol', () => {
    // Turkey wrap lunch (40 mg) + salmon dinner (54 mg): the omelet (186 mg) would make 280.
    const w = plan([[today, 'lunch', 'turkey-avocado-wrap'], [today, 'dinner', 'salmon-rice-broccoli']]);
    const fixes = fixesFor(w, CATALOG, taste, today, 'breakfast', meal('veggie-omelet'), today);
    const kinds = fixes.map((f) => f.kind);
    expect(kinds[0]).toBe('adjust');
    expect(fixes[0].text).toBe('Use egg whites instead of the whole egg');
    expect(kinds).toContain('instead');
    expect(kinds).toContain('otherDay');
    expect(fixes.find((f) => f.kind === 'otherDay')!.text).toBe('Have it tomorrow instead');
    // Every fix, applied, fits - and leaves the rest of the plan fitting.
    for (const f of fixes) {
      const after = apply(w, f.kind === 'otherDay' ? today : today, 'breakfast', meal('veggie-omelet'), f);
      const d = f.kind === 'otherDay' ? f.date : today;
      expect(checkSlot(after.world, d, 'breakfast', after.placed).fits, f.text).toBe(true);
      for (const p of after.world.plan) expect(checkSlot(after.world, p.date, p.slot, byId.get(p.mealId) ?? after.placed).fits, `${f.text}: ${p.date} ${p.slot}`).toBe(true);
    }
  });

  it('suggests changing another meal that day to make room', () => {
    // Salmon dinner (54 mg) + omelet (186 mg) = 240; a meatless dinner makes room.
    const w = plan([[today, 'dinner', 'salmon-rice-broccoli']]);
    const swap = fixesFor(w, CATALOG, taste, today, 'breakfast', meal('veggie-omelet'), today).find((f) => f.kind === 'swapOther');
    expect(swap).toMatchObject({ kind: 'swapOther', date: today, slot: 'dinner' });
    expect(swap!.text).toMatch(/^Have .+ for today's dinner instead of Baked salmon, rice & broccoli$/);
    if (swap?.kind !== 'swapOther') return;
    const after = withSlot(withSlot(w, swap.date, swap.slot, swap.toMealId), today, 'breakfast', 'veggie-omelet');
    expect(checkSlot(after, today, 'breakfast', meal('veggie-omelet')).fits).toBe(true);
    expect(checkSlot(after, today, 'dinner', meal(swap.toMealId)).fits).toBe(true);
  });

  it('frees an egg yolk by changing a later day in the week', () => {
    const d = (n: number) => addDays(today, n);
    const w = plan([[d(1), 'breakfast', 'veggie-omelet'], [d(2), 'breakfast', 'veggie-omelet'], [d(3), 'breakfast', 'veggie-omelet']]);
    const fixes = fixesFor(w, CATALOG, taste, today, 'breakfast', meal('veggie-omelet'), today);
    const later = fixes.find((f) => f.kind === 'swapOther');
    expect(later).toBeDefined();
    if (later?.kind === 'swapOther') {
      expect(later.date > today).toBe(true);
      expect(later.text).toMatch(/instead of Veggie omelet with toast$/);
    }
  });

  it('never tries to make room for a meal that is over on its own', () => {
    const heavy: Meal = { id: 'h', type: 'lunch', name: 'Big pasta', minutes: 10, items: [{ food: 'wwpasta', servings: 4 }, { food: 'chicken', servings: 1 }], steps: [] };
    const fixes = fixesFor(empty, CATALOG, taste, today, 'lunch', heavy, today);
    expect(fixes.some((f) => f.kind === 'swapOther' || f.kind === 'otherDay')).toBe(false);
    expect(fixes[0].kind).toBe('adjust');
  });
});

describe('what she ate counts over what was planned', () => {
  it('checks the rest of the day against the meal she actually had', () => {
    let w = plan([[today, 'lunch', 'lentil-spinach-soup'], [today, 'dinner', 'salmon-rice-broccoli']]);
    expect(checkSlot(w, today, 'dinner', meal('salmon-rice-broccoli')).fits).toBe(true);
    // She had the omelet for lunch instead of the soup: 186 + 54 mg.
    w = { ...w, log: [{ id: 'x', mealId: 'veggie-omelet', name: '', type: 'lunch', items: meal('veggie-omelet').items, eatenAt: new Date(2026, 10, 2, 12).toISOString() }] };
    expect(checkSlot(w, today, 'dinner', meal('salmon-rice-broccoli')).fits).toBe(false);
  });
});

describe('problems', () => {
  it('flags a planned meal that no longer fits, with ways to make it work', () => {
    let w = plan([[today, 'lunch', 'lentil-spinach-soup'], [today, 'dinner', 'salmon-rice-broccoli']]);
    w = { ...w, log: [{ id: 'x', mealId: 'veggie-omelet', name: '', type: 'lunch', items: meal('veggie-omelet').items, eatenAt: new Date(2026, 10, 2, 12).toISOString() }] };
    const found = problems(w, CATALOG, taste, today, 7, today);
    expect(found.map((p) => [p.date, p.slot, p.meal.id])).toEqual([[today, 'dinner', 'salmon-rice-broccoli']]);
    expect(found[0].reason).toBe("Doesn't fit: over the cholesterol for today");
    expect(found[0].fixes.length).toBeGreaterThan(0);
    expect(found[0].fixes.map((f) => f.kind)).toContain('instead');
  });

  it('is quiet when everything fits, and ignores eaten and past meals', () => {
    const w = plan([[addDays(today, -1), 'breakfast', 'veggie-omelet'], [today, 'lunch', 'lentil-spinach-soup']]);
    expect(problems(w, CATALOG, taste, addDays(today, -1), 7, today)).toEqual([]);
  });
});
