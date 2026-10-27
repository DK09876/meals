/**
 * The API routes, called directly with real Requests against a throwaway
 * database - the same as the phone calls them, minus the network.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'meals-api-'));
  vi.stubEnv('MEALS_DB_PATH', join(dir, 'meals.db'));
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const routes = async () => ({
  profiles: await import('@/app/api/profiles/route'),
  state: await import('@/app/api/state/route'),
  rules: await import('@/app/api/rules/route'),
  saved: await import('@/app/api/saved/route'),
  pantry: await import('@/app/api/pantry/route'),
  log: await import('@/app/api/log/route'),
  meals: await import('@/app/api/meals/route'),
  meal: await import('@/app/api/meals/[id]/route'),
});

const req = (path: string, method = 'GET', body?: unknown) =>
  new Request(`http://test/api/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: body === undefined ? undefined : { 'content-type': 'application/json' } });

async function grandma() {
  const r = await routes();
  const res = await r.profiles.POST(req('profiles', 'POST', { name: 'Grandma' }));
  expect((await res.json()).profile).toEqual({ id: 'grandma', name: 'Grandma' });
  return r;
}

const state = async (r: Awaited<ReturnType<typeof routes>>) => (await r.state.GET(req('state?profile=grandma'))).json();

describe('profiles', () => {
  it('starts a new person on the default limits', async () => {
    const r = await grandma();
    const s = await state(r);
    expect(s.rules).toEqual({ carbMeal: 35, carbSnack: 15, sodiumMeal: 600, satFatMeal: 4, cholesterolDay: 200, yolksWeek: 3 });
    expect(s).toMatchObject({ saved: [], pantry: [], custom: [], log: [] });
  });

  it('refuses data calls without a known profile', async () => {
    const r = await grandma();
    expect((await r.state.GET(req('state'))).status).toBe(400);
    expect((await r.state.GET(req('state?profile=nobody'))).status).toBe(400);
  });

  it('refuses a blank name', async () => {
    const r = await routes();
    expect((await r.profiles.POST(req('profiles', 'POST', { name: '  ' }))).status).toBe(400);
  });
});

describe('her limits', () => {
  it('saves a change made from the current version', async () => {
    const r = await grandma();
    const { rulesUpdatedAt } = await state(r);
    const res = await r.rules.PATCH(req('rules?profile=grandma', 'PATCH', { changes: { carbMeal: 30 }, base: rulesUpdatedAt }));
    expect(res.status).toBe(200);
    expect((await state(r)).rules.carbMeal).toBe(30);
  });

  it('refuses a change made from a stale copy with 409 and the real limits', async () => {
    const r = await grandma();
    const { rulesUpdatedAt: old } = await state(r);
    await r.rules.PATCH(req('rules?profile=grandma', 'PATCH', { changes: { carbMeal: 30 }, base: old }));
    const res = await r.rules.PATCH(req('rules?profile=grandma', 'PATCH', { changes: { sodiumMeal: 500 }, base: old }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.rules).toMatchObject({ carbMeal: 30, sodiumMeal: 600 });
    expect(body.rulesUpdatedAt).not.toBe(old);
  });

  it('refuses a limit out of range', async () => {
    const r = await grandma();
    const { rulesUpdatedAt } = await state(r);
    expect((await r.rules.PATCH(req('rules?profile=grandma', 'PATCH', { changes: { carbMeal: 500 }, base: rulesUpdatedAt }))).status).toBe(400);
  });
});

describe('saved and at home', () => {
  it('ticks things on and off, and saying it twice is harmless', async () => {
    const r = await grandma();
    await r.saved.PUT(req('saved?profile=grandma', 'PUT', { mealId: 'apple-pb', on: true }));
    await r.saved.PUT(req('saved?profile=grandma', 'PUT', { mealId: 'apple-pb', on: true }));
    await r.pantry.PUT(req('pantry?profile=grandma', 'PUT', { foodId: 'oats', on: true }));
    expect(await state(r)).toMatchObject({ saved: ['apple-pb'], pantry: ['oats'] });
    await r.saved.PUT(req('saved?profile=grandma', 'PUT', { mealId: 'apple-pb', on: false }));
    expect((await state(r)).saved).toEqual([]);
  });

  it('refuses unknown meals and foods', async () => {
    const r = await grandma();
    expect((await r.saved.PUT(req('saved?profile=grandma', 'PUT', { mealId: 'deep-fried-butter', on: true }))).status).toBe(404);
    expect((await r.pantry.PUT(req('pantry?profile=grandma', 'PUT', { foodId: 'bacon', on: true }))).status).toBe(400);
  });
});

describe('built meals', () => {
  const plate = [{ food: 'chicken', servings: 1 }, { food: 'quinoa', servings: 1 }, { food: 'broccoli', servings: 2 }];

  it('saves one that fits, with a name', async () => {
    const r = await grandma();
    const res = await r.meals.POST(req('meals?profile=grandma', 'POST', { type: 'dinner', items: plate }));
    const { meal } = await res.json();
    expect(meal).toMatchObject({ type: 'dinner', name: 'My dinner plate 1', custom: true, items: plate });
    expect((await state(r)).custom).toHaveLength(1);
  });

  it('refuses one over her carb limit, saying why', async () => {
    const r = await grandma();
    const res = await r.meals.POST(req('meals?profile=grandma', 'POST', { type: 'dinner', items: [...plate, { food: 'sweetpot', servings: 1 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Too many carbs: 8 g over');
  });

  it('refuses unknown foods and odd amounts', async () => {
    const r = await grandma();
    for (const items of [[{ food: 'bacon', servings: 1 }], [{ food: 'oats', servings: 0.3 }], [{ food: 'oats', servings: -1 }], []]) {
      expect((await r.meals.POST(req('meals?profile=grandma', 'POST', { type: 'lunch', items }))).status).toBe(400);
    }
  });

  it("keeps what she ate after the meal is deleted", async () => {
    const r = await grandma();
    const { meal } = await (await r.meals.POST(req('meals?profile=grandma', 'POST', { type: 'dinner', items: plate }))).json();
    await r.saved.PUT(req('saved?profile=grandma', 'PUT', { mealId: meal.id, on: true }));
    await r.log.POST(req('log?profile=grandma', 'POST', { mealId: meal.id }));
    const del = await r.meal.DELETE(req(`meals/${meal.id}?profile=grandma`, 'DELETE'), { params: Promise.resolve({ id: meal.id }) });
    expect(del.status).toBe(200);
    const s = await state(r);
    expect(s.custom).toEqual([]);
    expect(s.saved).toEqual([]);
    expect(s.log[0]).toMatchObject({ mealId: meal.id, name: 'My dinner plate 1', items: plate });
  });

  it("cannot delete another person's meal", async () => {
    const r = await grandma();
    await r.profiles.POST(req('profiles', 'POST', { name: 'Grandpa' }));
    const { meal } = await (await r.meals.POST(req('meals?profile=grandpa', 'POST', { type: 'dinner', items: plate }))).json();
    const del = await r.meal.DELETE(req(`meals/${meal.id}?profile=grandma`, 'DELETE'), { params: Promise.resolve({ id: meal.id }) });
    expect(del.status).toBe(404);
  });
});

describe('the log', () => {
  it('logs a meal with a copy of it, and takes it back', async () => {
    const r = await grandma();
    const { entry } = await (await r.log.POST(req('log?profile=grandma', 'POST', { mealId: 'veggie-omelet' }))).json();
    expect(entry).toMatchObject({ mealId: 'veggie-omelet', type: 'breakfast', name: 'Veggie omelet with toast' });
    expect((await state(r)).log).toHaveLength(1);
    expect((await r.log.DELETE(req(`log?profile=grandma&id=${entry.id}`, 'DELETE'))).status).toBe(200);
    expect((await state(r)).log).toHaveLength(0);
  });
});

describe('build id', () => {
  it('tells the page which build the server is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEALS_BUILD', 'b-123');
    const r = await grandma();
    expect((await r.state.GET(req('state?profile=grandma'))).headers.get('x-meals-build')).toBe('b-123');
  });
});
