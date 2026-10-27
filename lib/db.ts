/**
 * Storage. One SQLite file, same shape as LifeOS, MTG Tracker and Gains on the same Pi.
 *
 * A profile is a person being cooked for - Grandma - with her own limits.
 * The family shares that profile from their own phones: saving a meal or
 * logging what she ate on one phone shows on the others.
 *
 * Built-in meals live in code (catalog.ts); meals the family builds live here.
 * Each log entry copies the meal's items, so deleting a built meal never
 * rewrites what she ate.
 *
 * Her limits carry an updatedAt. A change says which version it was made
 * from, and a change made from an older copy is refused (409) rather than
 * quietly undoing what someone else just set - as LifeOS does with records.
 *
 * Profiles are separation, not security - anyone who can reach the app can
 * pick any profile, which is fine on a private tailnet.
 *
 * WASM SQLite, not the native addon: better-sqlite3 segfaults on the Pi
 * (Debian 13 aarch64), prebuilt and from source alike.
 */

import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

import { Database } from 'node-sqlite3-wasm';

import { catalogMeal, type Meal } from './catalog';
import type { LogEntry } from './history';
import { DEFAULT_RULES, type Item, type MealType, type Rules } from './rules';

const DB_PATH = process.env.MEALS_DB_PATH || `${process.cwd()}/data/meals.db`;

let db: Database | null = null;

function open(): Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules TEXT NOT NULL,
      rulesUpdatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
  db.run(`CREATE TABLE IF NOT EXISTS saved (profileId TEXT NOT NULL, mealId TEXT NOT NULL, createdAt TEXT NOT NULL, PRIMARY KEY (profileId, mealId))`);
  db.run(`CREATE TABLE IF NOT EXISTS pantry (profileId TEXT NOT NULL, foodId TEXT NOT NULL, PRIMARY KEY (profileId, foodId))`);
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_meals (
      id TEXT PRIMARY KEY,
      profileId TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      items TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      deletedAt TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_custom_profile ON custom_meals (profileId)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS meal_log (
      id TEXT PRIMARY KEY,
      profileId TEXT NOT NULL,
      mealId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      items TEXT NOT NULL,
      eatenAt TEXT NOT NULL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_log_profile ON meal_log (profileId, eatenAt)`);
  return db;
}

const now = () => new Date().toISOString();

/**
 * A timestamp that always moves forward, even for two saves in the same
 * millisecond - otherwise the second save could carry the first one's
 * version and slip past the stale check.
 */
let lastStamp = '';
function stamp(): string {
  let next = now();
  if (next <= lastStamp) next = new Date(Date.parse(lastStamp) + 1).toISOString();
  lastStamp = next;
  return next;
}

// --- profiles ------------------------------------------------------------

export interface Profile {
  id: string;
  name: string;
}

export function listProfiles(): Profile[] {
  return open().all('SELECT id, name FROM profiles ORDER BY createdAt') as unknown as Profile[];
}

/** The profile id if it exists, else null - so a typo cannot store things nobody can see. */
export function knownProfile(id: string | null): string | null {
  if (!id) return null;
  const row = open().get('SELECT id FROM profiles WHERE id = ?', [id]) as { id: string } | null;
  return row?.id ?? null;
}

export function addProfile(id: string, name: string): Profile {
  const at = now();
  open().run('INSERT INTO profiles (id, name, rules, rulesUpdatedAt, createdAt) VALUES (?, ?, ?, ?, ?)', [id, name, JSON.stringify(DEFAULT_RULES), at, at]);
  return { id, name };
}

/** "Grandma" becomes `grandma`, and a second "Grandma" `grandma-2`. */
export function createProfile(name: string): Profile {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'person';
  let id = base;
  for (let n = 2; knownProfile(id); n++) id = `${base}-${n}`;
  return addProfile(id, name);
}

// --- rules ---------------------------------------------------------------

export interface RulesRecord {
  rules: Rules;
  updatedAt: string;
}

export function getRules(profileId: string): RulesRecord {
  const row = open().get('SELECT rules, rulesUpdatedAt FROM profiles WHERE id = ?', [profileId]) as { rules: string; rulesUpdatedAt: string };
  // Rules added after a profile was made take their defaults.
  return { rules: { ...DEFAULT_RULES, ...JSON.parse(row.rules) }, updatedAt: row.rulesUpdatedAt };
}

export type PatchResult = { ok: true; record: RulesRecord } | { ok: false; record: RulesRecord };

/** Applies a change made from version `base`; refused if her limits have changed since. */
export function patchRules(profileId: string, changes: Partial<Rules>, base: string): PatchResult {
  const current = getRules(profileId);
  if (current.updatedAt !== base) return { ok: false, record: current };
  const rules = { ...current.rules, ...changes };
  const updatedAt = stamp();
  open().run('UPDATE profiles SET rules = ?, rulesUpdatedAt = ? WHERE id = ?', [JSON.stringify(rules), updatedAt, profileId]);
  return { ok: true, record: { rules, updatedAt } };
}

// --- saved and at-home ---------------------------------------------------

export function listSaved(profileId: string): string[] {
  return (open().all('SELECT mealId FROM saved WHERE profileId = ? ORDER BY createdAt', [profileId]) as Array<{ mealId: string }>).map((r) => r.mealId);
}

export function setSaved(profileId: string, mealId: string, on: boolean): void {
  if (on) open().run('INSERT OR IGNORE INTO saved (profileId, mealId, createdAt) VALUES (?, ?, ?)', [profileId, mealId, now()]);
  else open().run('DELETE FROM saved WHERE profileId = ? AND mealId = ?', [profileId, mealId]);
}

export function listPantry(profileId: string): string[] {
  return (open().all('SELECT foodId FROM pantry WHERE profileId = ? ORDER BY foodId', [profileId]) as Array<{ foodId: string }>).map((r) => r.foodId);
}

export function setPantry(profileId: string, foodId: string, on: boolean): void {
  if (on) open().run('INSERT OR IGNORE INTO pantry (profileId, foodId) VALUES (?, ?)', [profileId, foodId]);
  else open().run('DELETE FROM pantry WHERE profileId = ? AND foodId = ?', [profileId, foodId]);
}

// --- built meals ---------------------------------------------------------

interface CustomRow { id: string; type: MealType; name: string; items: string }

const toMeal = (row: CustomRow): Meal => ({ id: row.id, type: row.type, name: row.name, items: JSON.parse(row.items), minutes: null, steps: [], custom: true });

export function listCustomMeals(profileId: string): Meal[] {
  return (open().all('SELECT id, type, name, items FROM custom_meals WHERE profileId = ? AND deletedAt IS NULL ORDER BY createdAt', [profileId]) as unknown as CustomRow[]).map(toMeal);
}

export function customMealCount(profileId: string): number {
  return (open().get('SELECT count(*) AS c FROM custom_meals WHERE profileId = ?', [profileId]) as { c: number }).c;
}

export function addCustomMeal(profileId: string, type: MealType, name: string, items: Item[]): Meal {
  const id = `c-${randomUUID()}`;
  const clean = items.map(({ food, servings }) => ({ food, servings }));
  open().run('INSERT INTO custom_meals (id, profileId, type, name, items, createdAt) VALUES (?, ?, ?, ?, ?, ?)', [id, profileId, type, name, JSON.stringify(clean), now()]);
  return { id, type, name, items: clean, minutes: null, steps: [], custom: true };
}

/** Kept in the table, so history and backups still know what it was. Unsaved as well. */
export function deleteCustomMeal(profileId: string, id: string): boolean {
  const result = open().run('UPDATE custom_meals SET deletedAt = ? WHERE id = ? AND profileId = ? AND deletedAt IS NULL', [now(), id, profileId]);
  open().run('DELETE FROM saved WHERE profileId = ? AND mealId = ?', [profileId, id]);
  return result.changes > 0;
}

/** A built-in meal, or one of this profile's own that has not been deleted. */
export function findMeal(profileId: string, id: string): Meal | undefined {
  const builtIn = catalogMeal(id);
  if (builtIn) return builtIn;
  const row = open().get('SELECT id, type, name, items FROM custom_meals WHERE id = ? AND profileId = ? AND deletedAt IS NULL', [id, profileId]) as CustomRow | null;
  return row ? toMeal(row) : undefined;
}

// --- what she ate ----------------------------------------------------------

interface LogRow { id: string; mealId: string; name: string; type: MealType; items: string; eatenAt: string }

const toEntry = (row: LogRow): LogEntry => ({ ...row, items: JSON.parse(row.items) });

/** The last few weeks - enough for history and the seven-day egg count. */
export function listLog(profileId: string, sinceDays = 30): LogEntry[] {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  return (open().all('SELECT id, mealId, name, type, items, eatenAt FROM meal_log WHERE profileId = ? AND eatenAt >= ? ORDER BY eatenAt DESC', [profileId, since]) as unknown as LogRow[]).map(toEntry);
}

export function logMeal(profileId: string, meal: Meal, eatenAt = now()): LogEntry {
  const entry: LogEntry = { id: randomUUID(), mealId: meal.id, name: meal.name, type: meal.type, items: meal.items, eatenAt };
  open().run('INSERT INTO meal_log (id, profileId, mealId, name, type, items, eatenAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [entry.id, profileId, entry.mealId, entry.name, entry.type, JSON.stringify(entry.items), entry.eatenAt]);
  return entry;
}

export function deleteLogEntry(profileId: string, id: string): boolean {
  return open().run('DELETE FROM meal_log WHERE id = ? AND profileId = ?', [id, profileId]).changes > 0;
}
