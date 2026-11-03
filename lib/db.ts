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
import { DEFAULT_RULES, RULE_KEYS, type Item, type MealType, type Rules } from './rules';

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
  // Added with the week planner (2026-11-02).
  const customCols = (db.all('PRAGMA table_info(custom_meals)') as Array<{ name: string }>).map((c) => c.name);
  if (!customCols.includes('steps')) db.run(`ALTER TABLE custom_meals ADD COLUMN steps TEXT NOT NULL DEFAULT '[]'`);
  if (!customCols.includes('minutes')) db.run(`ALTER TABLE custom_meals ADD COLUMN minutes INTEGER`);
  if (!customCols.includes('note')) db.run(`ALTER TABLE custom_meals ADD COLUMN note TEXT`);
  if (!customCols.includes('source')) db.run(`ALTER TABLE custom_meals ADD COLUMN source TEXT NOT NULL DEFAULT 'built'`);
  // 1 = a favourite, -1 = "not for me" (never suggested). No row = no opinion.
  db.run(`CREATE TABLE IF NOT EXISTS likes (profileId TEXT NOT NULL, mealId TEXT NOT NULL, value INTEGER NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY (profileId, mealId))`);
  // Bookmarks from v1 became favourites.
  db.run(`INSERT OR IGNORE INTO likes (profileId, mealId, value, updatedAt) SELECT profileId, mealId, 1, createdAt FROM saved`);
  db.run(`DELETE FROM saved`);
  db.run(`CREATE TABLE IF NOT EXISTS plan (profileId TEXT NOT NULL, date TEXT NOT NULL, slot TEXT NOT NULL, mealId TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY (profileId, date, slot))`);
  db.run(`CREATE TABLE IF NOT EXISTS photos (mealId TEXT PRIMARY KEY, file TEXT NOT NULL, mime TEXT NOT NULL, credit TEXT NOT NULL DEFAULT '', license TEXT NOT NULL DEFAULT '', page TEXT NOT NULL DEFAULT '', updatedAt TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (tokenHash TEXT PRIMARY KEY, createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL)`);
  // The testing phase (2026-11-02): what people say about the app, with where they were.
  db.run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      profileId TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      path TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT '',
      device TEXT NOT NULL DEFAULT '',
      build TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      doneAt TEXT
    )
  `);
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
  // Rules added after a profile was made take their defaults; retired ones
  // (the per-meal saturated fat limit, replaced 2026-10-27 by her handout's
  // 5% of calories) are dropped.
  const stored = JSON.parse(row.rules) as Record<string, number>;
  const rules = { ...DEFAULT_RULES };
  for (const key of RULE_KEYS) if (typeof stored[key] === 'number') rules[key] = stored[key];
  return { rules, updatedAt: row.rulesUpdatedAt };
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

// --- favourites and at-home ----------------------------------------------

/** mealId → 1 (favourite) or -1 (not for me). */
export function listLikes(profileId: string): Record<string, 1 | -1> {
  const rows = open().all('SELECT mealId, value FROM likes WHERE profileId = ?', [profileId]) as Array<{ mealId: string; value: 1 | -1 }>;
  return Object.fromEntries(rows.map((r) => [r.mealId, r.value]));
}

/** 0 clears the opinion. */
export function setLike(profileId: string, mealId: string, value: 1 | 0 | -1): void {
  if (value === 0) open().run('DELETE FROM likes WHERE profileId = ? AND mealId = ?', [profileId, mealId]);
  else open().run('INSERT INTO likes (profileId, mealId, value, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT (profileId, mealId) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt', [profileId, mealId, value, now()]);
}

export function listPantry(profileId: string): string[] {
  return (open().all('SELECT foodId FROM pantry WHERE profileId = ? ORDER BY foodId', [profileId]) as Array<{ foodId: string }>).map((r) => r.foodId);
}

export function setPantry(profileId: string, foodId: string, on: boolean): void {
  if (on) open().run('INSERT OR IGNORE INTO pantry (profileId, foodId) VALUES (?, ?)', [profileId, foodId]);
  else open().run('DELETE FROM pantry WHERE profileId = ? AND foodId = ?', [profileId, foodId]);
}

// --- built meals ---------------------------------------------------------

interface CustomRow { id: string; type: MealType; name: string; items: string; steps: string; minutes: number | null; note: string | null; source: string }

const CUSTOM_COLS = 'id, type, name, items, steps, minutes, note, source';

const toMeal = (row: CustomRow): Meal => ({
  id: row.id, type: row.type, name: row.name, items: JSON.parse(row.items), minutes: row.minutes ?? null,
  steps: JSON.parse(row.steps || '[]'), ...(row.note ? { note: row.note } : {}), custom: true,
  source: row.source === 'chat' ? 'chat' : row.source === 'fixed' ? 'fixed' : 'built',
});

export function listCustomMeals(profileId: string): Meal[] {
  return (open().all(`SELECT ${CUSTOM_COLS} FROM custom_meals WHERE profileId = ? AND deletedAt IS NULL ORDER BY createdAt`, [profileId]) as unknown as CustomRow[]).map(toMeal);
}

export function customMealCount(profileId: string): number {
  return (open().get('SELECT count(*) AS c FROM custom_meals WHERE profileId = ?', [profileId]) as { c: number }).c;
}

export interface CustomExtras {
  steps?: string[];
  minutes?: number | null;
  note?: string;
  /** built on the Build screen, a fixed copy of another recipe, or from chat. */
  source?: 'built' | 'fixed' | 'chat';
}

export function addCustomMeal(profileId: string, type: MealType, name: string, items: Item[], extras: CustomExtras = {}): Meal {
  const id = `c-${randomUUID()}`;
  const clean = items.map(({ food, servings, label }) => (label ? { food, servings, label } : { food, servings }));
  open().run('INSERT INTO custom_meals (id, profileId, type, name, items, steps, minutes, note, source, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, profileId, type, name, JSON.stringify(clean), JSON.stringify(extras.steps ?? []), extras.minutes ?? null, extras.note ?? null, extras.source ?? 'built', now()]);
  return toMeal({ id, type, name, items: JSON.stringify(clean), steps: JSON.stringify(extras.steps ?? []), minutes: extras.minutes ?? null, note: extras.note ?? null, source: extras.source ?? 'built' });
}

/** Kept in the table, so history and backups still know what it was. Taken off favourites and the plan. */
export function deleteCustomMeal(profileId: string, id: string): boolean {
  const result = open().run('UPDATE custom_meals SET deletedAt = ? WHERE id = ? AND profileId = ? AND deletedAt IS NULL', [now(), id, profileId]);
  open().run('DELETE FROM likes WHERE profileId = ? AND mealId = ?', [profileId, id]);
  open().run('DELETE FROM plan WHERE profileId = ? AND mealId = ?', [profileId, id]);
  return result.changes > 0;
}

/** A built-in meal, or one of this profile's own that has not been deleted. */
export function findMeal(profileId: string, id: string): Meal | undefined {
  const builtIn = catalogMeal(id);
  if (builtIn) return builtIn;
  const row = open().get(`SELECT ${CUSTOM_COLS} FROM custom_meals WHERE id = ? AND profileId = ? AND deletedAt IS NULL`, [id, profileId]) as CustomRow | null;
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

// --- the week plan ---------------------------------------------------------

export interface PlanRow { date: string; slot: MealType; mealId: string }

/** From two weeks back onward: enough for "this week" and planning ahead. */
export function listPlan(profileId: string, from: string): PlanRow[] {
  return open().all('SELECT date, slot, mealId FROM plan WHERE profileId = ? AND date >= ? ORDER BY date, slot', [profileId, from]) as unknown as PlanRow[];
}

/** Puts a meal in a slot, replacing what was there; null empties it. */
export function setPlanSlot(profileId: string, date: string, slot: MealType, mealId: string | null): void {
  if (mealId === null) open().run('DELETE FROM plan WHERE profileId = ? AND date = ? AND slot = ?', [profileId, date, slot]);
  else open().run('INSERT INTO plan (profileId, date, slot, mealId, updatedAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT (profileId, date, slot) DO UPDATE SET mealId = excluded.mealId, updatedAt = excluded.updatedAt', [profileId, date, slot, mealId, now()]);
}

/** Fills only slots that are still empty - two phones filling at once cannot overwrite each other. */
export function addPlanEntries(profileId: string, entries: PlanRow[]): number {
  let added = 0;
  for (const e of entries) {
    added += open().run('INSERT OR IGNORE INTO plan (profileId, date, slot, mealId, updatedAt) VALUES (?, ?, ?, ?, ?)', [profileId, e.date, e.slot, e.mealId, now()]).changes;
  }
  return added;
}

// --- photos ----------------------------------------------------------------

export interface PhotoRow { mealId: string; file: string; mime: string; credit: string; license: string; page: string; updatedAt: string }

export const getPhoto = (mealId: string) => open().get('SELECT * FROM photos WHERE mealId = ?', [mealId]) as unknown as PhotoRow | null;

/** mealId → version, for cache-busting image URLs. */
export function listPhotos(): Record<string, { v: string; credit: string; license: string; page: string }> {
  const rows = open().all('SELECT mealId, credit, license, page, updatedAt FROM photos') as unknown as PhotoRow[];
  return Object.fromEntries(rows.map((r) => [r.mealId, { v: r.updatedAt, credit: r.credit, license: r.license, page: r.page }]));
}

export function savePhotoRow(row: Omit<PhotoRow, 'updatedAt'>): void {
  open().run('INSERT INTO photos (mealId, file, mime, credit, license, page, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (mealId) DO UPDATE SET file = excluded.file, mime = excluded.mime, credit = excluded.credit, license = excluded.license, page = excluded.page, updatedAt = excluded.updatedAt',
    [row.mealId, row.file, row.mime, row.credit, row.license, row.page, stamp()]);
}

// --- settings and admin sessions --------------------------------------------

export function getSetting(key: string): string | null {
  return (open().get('SELECT value FROM settings WHERE key = ?', [key]) as { value: string } | null)?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) open().run('DELETE FROM settings WHERE key = ?', [key]);
  else open().run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value]);
}

export function addSession(tokenHash: string, expiresAt: string): void {
  open().run('DELETE FROM admin_sessions WHERE expiresAt < ?', [now()]);
  open().run('INSERT INTO admin_sessions (tokenHash, createdAt, expiresAt) VALUES (?, ?, ?)', [tokenHash, now(), expiresAt]);
}

export const sessionValid = (tokenHash: string) =>
  !!open().get('SELECT 1 AS ok FROM admin_sessions WHERE tokenHash = ? AND expiresAt > ?', [tokenHash, now()]);

export const deleteSession = (tokenHash: string) => open().run('DELETE FROM admin_sessions WHERE tokenHash = ?', [tokenHash]);
export const deleteAllSessions = () => open().run('DELETE FROM admin_sessions');

/** The database file's folder - photos live beside it, so one folder is the whole backup. */
export const DATA_DIR = dirname(DB_PATH);

// --- feedback (the testing phase) -------------------------------------------

export type FeedbackKind = 'good' | 'confusing' | 'wrong' | 'idea';
export const FEEDBACK_KINDS: FeedbackKind[] = ['good', 'confusing', 'wrong', 'idea'];

export interface Feedback {
  id: string;
  profileId: string;
  kind: FeedbackKind;
  text: string;
  path: string;
  mode: string;
  device: string;
  build: string;
  createdAt: string;
  doneAt: string | null;
}

export function addFeedback(f: Omit<Feedback, 'id' | 'createdAt' | 'doneAt'>): Feedback {
  const row: Feedback = { ...f, id: randomUUID(), createdAt: now(), doneAt: null };
  open().run('INSERT INTO feedback (id, profileId, kind, text, path, mode, device, build, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [row.id, row.profileId, row.kind, row.text, row.path, row.mode, row.device, row.build, row.createdAt]);
  return row;
}

export const listFeedback = (limit = 200) =>
  open().all('SELECT * FROM feedback ORDER BY createdAt DESC LIMIT ?', [limit]) as unknown as Feedback[];

export const feedbackToday = (profileId: string) =>
  (open().get('SELECT count(*) AS c FROM feedback WHERE profileId = ? AND createdAt >= ?', [profileId, new Date(Date.now() - 86_400_000).toISOString()]) as { c: number }).c;

export function setFeedbackDone(id: string, done: boolean): boolean {
  return open().run('UPDATE feedback SET doneAt = ? WHERE id = ?', [done ? now() : null, id]).changes > 0;
}
