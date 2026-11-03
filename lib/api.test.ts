/**
 * The API routes, called directly with real Requests against a throwaway
 * database - the same as the phone calls them, minus the network.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addDays, dayKey } from './dates';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'meals-api-'));
  vi.stubEnv('MEALS_DB_PATH', join(dir, 'meals.db'));
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

const routes = async () => ({
  admin: await import('@/app/api/admin/route'),
  profiles: await import('@/app/api/profiles/route'),
  state: await import('@/app/api/state/route'),
  rules: await import('@/app/api/rules/route'),
  likes: await import('@/app/api/likes/route'),
  pantry: await import('@/app/api/pantry/route'),
  log: await import('@/app/api/log/route'),
  meals: await import('@/app/api/meals/route'),
  meal: await import('@/app/api/meals/[id]/route'),
  plan: await import('@/app/api/plan/route'),
  photo: await import('@/app/api/photos/[id]/route'),
  photoSearch: await import('@/app/api/photos/search/route'),
  settings: await import('@/app/api/settings/route'),
});

let cookie = '';
const req = (path: string, method = 'GET', body?: unknown, asAdmin = true) =>
  new Request(`http://test/api/${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(asAdmin && cookie ? { cookie } : {}) },
  });

type R = Awaited<ReturnType<typeof routes>>;

/** Grandma, and an admin session for this test. */
async function setup(): Promise<R> {
  const r = await routes();
  cookie = '';
  const res = await r.profiles.POST(req('profiles', 'POST', { name: 'Grandma' }));
  expect((await res.json()).profile).toEqual({ id: 'grandma', name: 'Grandma' });
  const admin = await r.admin.POST(req('admin', 'POST', { action: 'setup', password: 'lemon' }));
  cookie = admin.headers.get('set-cookie')!.split(';')[0];
  return r;
}

const state = async (r: R) => (await r.state.GET(req('state?profile=grandma'))).json();
const P = 'profile=grandma';

describe('profiles', () => {
  it('starts a new person on the default limits', async () => {
    const r = await setup();
    const s = await state(r);
    expect(s.rules).toEqual({ carbMeal: 35, carbSnack: 15, sodiumMeal: 600, satFatPct: 5, calorieDay: 1600, cholesterolDay: 200, yolksWeek: 3 });
    expect(s).toMatchObject({ likes: {}, pantry: [], custom: [], log: [], plan: [], admin: true, adminConfigured: true });
  });

  it('refuses data calls without a known profile', async () => {
    const r = await setup();
    expect((await r.state.GET(req('state'))).status).toBe(400);
    expect((await r.state.GET(req('state?profile=nobody'))).status).toBe(400);
  });

  it('lets anyone add the first person, then only an admin', async () => {
    const r = await setup();
    expect((await r.profiles.POST(req('profiles', 'POST', { name: 'Grandpa' }, false))).status).toBe(403);
    expect((await r.profiles.POST(req('profiles', 'POST', { name: 'Grandpa' }))).status).toBe(200);
  });
});

describe('admin mode', () => {
  it('sets the password once, signs in and out, and rate-limits guessing', async () => {
    const r = await setup();
    expect((await r.admin.POST(req('admin', 'POST', { action: 'setup', password: 'other' }))).status).toBe(409);
    expect(await (await r.admin.GET(req('admin', 'GET', undefined, false))).json()).toEqual({ configured: true, admin: false });
    expect(await (await r.admin.GET(req('admin'))).json()).toEqual({ configured: true, admin: true });
    for (let n = 0; n < 5; n++) expect((await r.admin.POST(req('admin', 'POST', { action: 'login', password: 'wrong' }, false))).status).toBe(401);
    expect((await r.admin.POST(req('admin', 'POST', { action: 'login', password: 'lemon' }, false))).status).toBe(429);
  });

  it('a fresh login works and logout ends it', async () => {
    const r = await setup();
    const res = await r.admin.POST(req('admin', 'POST', { action: 'login', password: 'lemon' }, false));
    expect(res.status).toBe(200);
    cookie = res.headers.get('set-cookie')!.split(';')[0];
    await r.admin.POST(req('admin', 'POST', { action: 'logout' }));
    expect((await (await r.admin.GET(req('admin'))).json()).admin).toBe(false);
  });

  it('guards her limits, the at-home list and deleting meals', async () => {
    const r = await setup();
    const { rulesUpdatedAt } = await state(r);
    expect((await r.rules.PATCH(req(`rules?${P}`, 'PATCH', { changes: { carbMeal: 30 }, base: rulesUpdatedAt }, false))).status).toBe(403);
    expect((await r.pantry.PUT(req(`pantry?${P}`, 'PUT', { foodId: 'oats', on: true }, false))).status).toBe(403);
  });
});

describe('her limits', () => {
  it('saves a change made from the current version', async () => {
    const r = await setup();
    const { rulesUpdatedAt } = await state(r);
    expect((await r.rules.PATCH(req(`rules?${P}`, 'PATCH', { changes: { carbMeal: 30 }, base: rulesUpdatedAt }))).status).toBe(200);
    expect((await state(r)).rules.carbMeal).toBe(30);
  });

  it('refuses a change made from a stale copy with 409 and the real limits', async () => {
    const r = await setup();
    const { rulesUpdatedAt: old } = await state(r);
    await r.rules.PATCH(req(`rules?${P}`, 'PATCH', { changes: { carbMeal: 30 }, base: old }));
    const res = await r.rules.PATCH(req(`rules?${P}`, 'PATCH', { changes: { sodiumMeal: 500 }, base: old }));
    expect(res.status).toBe(409);
    expect((await res.json()).rules).toMatchObject({ carbMeal: 30, sodiumMeal: 600 });
  });
});

describe('favourites', () => {
  it('marks a favourite or "not for me", and clears it', async () => {
    const r = await setup();
    await r.likes.PUT(req(`likes?${P}`, 'PUT', { mealId: 'apple-pb', value: 1 }, false));
    await r.likes.PUT(req(`likes?${P}`, 'PUT', { mealId: 'veggie-omelet', value: -1 }, false));
    expect((await state(r)).likes).toEqual({ 'apple-pb': 1, 'veggie-omelet': -1 });
    await r.likes.PUT(req(`likes?${P}`, 'PUT', { mealId: 'apple-pb', value: 0 }, false));
    expect((await state(r)).likes).toEqual({ 'veggie-omelet': -1 });
    expect((await r.likes.PUT(req(`likes?${P}`, 'PUT', { mealId: 'deep-fried-butter', value: 1 }))).status).toBe(404);
  });
});

describe('the week plan', () => {
  const today = dayKey(new Date());

  it('puts a meal in a slot and empties it', async () => {
    const r = await setup();
    expect((await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: today, slot: 'lunch', mealId: 'lentil-spinach-soup' }, false))).status).toBe(200);
    expect((await state(r)).plan).toEqual([{ date: today, slot: 'lunch', mealId: 'lentil-spinach-soup' }]);
    await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: today, slot: 'lunch', mealId: null }, false));
    expect((await state(r)).plan).toEqual([]);
  });

  it('refuses a meal of the wrong type', async () => {
    const r = await setup();
    expect((await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: today, slot: 'dinner', mealId: 'apple-pb' }))).status).toBe(400);
  });

  it('refuses a meal over the week\'s egg yolks, offering what fits instead', async () => {
    const r = await setup();
    for (const d of [0, 1, 2]) {
      expect((await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: addDays(today, d), slot: 'breakfast', mealId: 'veggie-omelet' }, false))).status).toBe(200);
    }
    const res = await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: addDays(today, 3), slot: 'breakfast', mealId: 'veggie-omelet', weekStart: today }, false));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Doesn't fit: over the egg yolks for this week");
    expect(body.instead.length).toBeGreaterThan(0);
    expect(body.instead).not.toContain('veggie-omelet');
    // An admin can still put it there on purpose.
    expect((await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: addDays(today, 3), slot: 'breakfast', mealId: 'veggie-omelet', force: true }))).status).toBe(200);
    expect((await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: addDays(today, 4), slot: 'breakfast', mealId: 'veggie-omelet', force: true }, false))).status).toBe(422);
  });

  it('fills a week, keeps what was there, and every day stays within her limits', async () => {
    const r = await setup();
    await r.likes.PUT(req(`likes?${P}`, 'PUT', { mealId: 'pb-toast-apple', value: -1 }, false));
    await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: today, slot: 'dinner', mealId: 'lemon-cod-asparagus' }, false));
    const res = await r.plan.POST(req(`plan?${P}`, 'POST', { action: 'fill', start: today }, false));
    expect((await res.json()).added).toBe(27);
    const { plan } = await state(r);
    expect(plan).toHaveLength(28);
    expect(plan.find((p: { date: string; slot: string }) => p.date === today && p.slot === 'dinner').mealId).toBe('lemon-cod-asparagus');
    expect(plan.map((p: { mealId: string }) => p.mealId)).not.toContain('pb-toast-apple');
    // Filling again adds nothing.
    expect((await (await r.plan.POST(req(`plan?${P}`, 'POST', { action: 'fill', start: today }, false))).json()).added).toBe(0);
  });
});

describe('built meals', () => {
  const plate = [{ food: 'chicken', servings: 1 }, { food: 'quinoa', servings: 1 }, { food: 'broccoli', servings: 2 }];

  it('saves one that fits, with a name', async () => {
    const r = await setup();
    const { meal } = await (await r.meals.POST(req(`meals?${P}`, 'POST', { type: 'dinner', items: plate }))).json();
    expect(meal).toMatchObject({ type: 'dinner', name: 'My dinner plate 1', custom: true, source: 'built', items: plate });
  });

  it('saves a fixed copy of a recipe with its steps', async () => {
    const r = await setup();
    const { meal } = await (await r.meals.POST(req(`meals?${P}`, 'POST', { type: 'dinner', name: 'Salmon (lighter rice)', items: plate, steps: ['Bake it.'], minutes: 25, source: 'fixed' }, false))).json();
    expect(meal).toMatchObject({ name: 'Salmon (lighter rice)', steps: ['Bake it.'], minutes: 25, source: 'fixed' });
  });

  it('refuses one over her carb limit, saying why', async () => {
    const r = await setup();
    const res = await r.meals.POST(req(`meals?${P}`, 'POST', { type: 'dinner', items: [...plate, { food: 'sweetpot', servings: 1 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Too many carbs: 8 g over');
  });

  it('keeps what she ate after the meal is deleted, and takes it off the plan', async () => {
    const r = await setup();
    const { meal } = await (await r.meals.POST(req(`meals?${P}`, 'POST', { type: 'dinner', items: plate }))).json();
    await r.likes.PUT(req(`likes?${P}`, 'PUT', { mealId: meal.id, value: 1 }));
    await r.plan.PUT(req(`plan?${P}`, 'PUT', { date: dayKey(new Date()), slot: 'dinner', mealId: meal.id }));
    await r.log.POST(req(`log?${P}`, 'POST', { mealId: meal.id }));
    expect((await r.meal.DELETE(req(`meals/${meal.id}?${P}`, 'DELETE', undefined, false), { params: Promise.resolve({ id: meal.id }) })).status).toBe(403);
    expect((await r.meal.DELETE(req(`meals/${meal.id}?${P}`, 'DELETE'), { params: Promise.resolve({ id: meal.id }) })).status).toBe(200);
    const s = await state(r);
    expect(s).toMatchObject({ custom: [], likes: {}, plan: [] });
    expect(s.log[0]).toMatchObject({ mealId: meal.id, name: 'My dinner plate 1' });
  });
});

describe('the log', () => {
  it('logs a meal with a copy of it, and takes it back', async () => {
    const r = await setup();
    const { entry } = await (await r.log.POST(req(`log?${P}`, 'POST', { mealId: 'veggie-omelet' }, false))).json();
    expect(entry).toMatchObject({ mealId: 'veggie-omelet', type: 'breakfast' });
    expect((await r.log.DELETE(req(`log?${P}&id=${entry.id}`, 'DELETE', undefined, false))).status).toBe(200);
    expect((await state(r)).log).toHaveLength(0);
  });
});

describe('photos', () => {
  // A 1×1 JPEG's first bytes are enough for the type check.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  it('searches Commons and saves a chosen photo - never touching the real network', async () => {
    vi.stubEnv('MEALS_PHOTO_DIR', join(dir, 'photos'));
    const r = await setup();
    const fetchMock = vi.fn(async (url: URL | string) => {
      const u = String(url);
      if (u.startsWith('https://commons.wikimedia.org/')) {
        return Response.json({ query: { pages: { 1: { index: 1, title: 'File:Lentil soup.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/x/800px-Lentil.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Lentil_soup.jpg', mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC0' }, Artist: { value: '<a href="#">Ann</a>' } } }] } } } });
      }
      if (u.startsWith('https://upload.wikimedia.org/')) return new Response(jpeg);
      throw new Error(`unexpected fetch ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await r.photoSearch.GET(req('photos/search?q=lentil', 'GET', undefined, false))).status).toBe(403);
    const { candidates } = await (await r.photoSearch.GET(req('photos/search?q=lentil+soup'))).json();
    expect(candidates).toEqual([{ title: 'Lentil soup', thumb: 'https://upload.wikimedia.org/x/800px-Lentil.jpg', page: 'https://commons.wikimedia.org/wiki/File:Lentil_soup.jpg', license: 'CC0', credit: 'Ann' }]);
    const ctx = { params: Promise.resolve({ id: 'lentil-spinach-soup' }) };
    expect((await r.photo.POST(req('photos/lentil-spinach-soup', 'POST', candidates[0]), ctx)).status).toBe(200);
    const got = await r.photo.GET(req('photos/lentil-spinach-soup'), { params: Promise.resolve({ id: 'lentil-spinach-soup' }) });
    expect(got.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(jpeg);
    expect((await state(r)).photos['lentil-spinach-soup']).toMatchObject({ credit: 'Ann', license: 'CC0' });
  });

  it('only fetches from Wikimedia, and only real pictures', async () => {
    vi.stubEnv('MEALS_PHOTO_DIR', join(dir, 'photos'));
    const r = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>')));
    const ctx = { params: Promise.resolve({ id: 'apple-pb' }) };
    expect((await (await r.photo.POST(req('photos/apple-pb', 'POST', { thumb: 'https://evil.example/x.jpg' }), ctx)).json()).error).toMatch(/Only Wikimedia/);
    expect((await (await r.photo.POST(req('photos/apple-pb', 'POST', { thumb: 'https://upload.wikimedia.org/x.jpg' }), { params: Promise.resolve({ id: 'apple-pb' }) })).json()).error).toMatch(/not a JPEG/);
  });
});

describe('store setting', () => {
  it('saves an Instacart store for admins only, and only a plain slug', async () => {
    const r = await setup();
    expect((await r.settings.PUT(req('settings', 'PUT', { store: 'costco' }, false))).status).toBe(403);
    expect((await r.settings.PUT(req('settings', 'PUT', { store: '../x' }))).status).toBe(400);
    expect((await r.settings.PUT(req('settings', 'PUT', { store: 'Costco' }))).status).toBe(200);
    expect((await state(r)).store).toBe('costco');
    await r.settings.PUT(req('settings', 'PUT', { store: '' }));
    expect((await state(r)).store).toBe('');
  });
});

describe('build id', () => {
  it('tells the page which build the server is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEALS_BUILD', 'b-123');
    const r = await setup();
    expect((await r.state.GET(req(`state?${P}`))).headers.get('x-meals-build')).toBe('b-123');
  });
});
