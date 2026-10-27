#!/usr/bin/env node
/**
 * Manage Meals profiles, like MTG Tracker's scripts/profile.cjs.
 *
 *   node scripts/profile.cjs list
 *   node scripts/profile.cjs add <id> "<display name>"
 *   node scripts/profile.cjs rename <id> "<display name>"
 *
 * A profile is a person being cooked for, with their own limits - there is no password.
 * Uses the app's own database (data/meals.db next to this folder) unless
 * MEALS_DB_PATH says otherwise. Stop the `meals` service first: two
 * processes writing the WASM SQLite file at once is unsafe.
 */

const { mkdirSync } = require('fs');
const { dirname, join } = require('path');
const { Database } = require('node-sqlite3-wasm');

// Relative to the app, not the current directory, so running it from
// anywhere else cannot create an empty database of its own.
const DB_PATH = process.env.MEALS_DB_PATH || join(__dirname, '..', 'data', 'meals.db');
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

// Same shape as lib/db.ts; a profile made here starts on the default limits.
db.run(`CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, rules TEXT NOT NULL, rulesUpdatedAt TEXT NOT NULL, createdAt TEXT NOT NULL)`);
const DEFAULT_RULES = { carbMeal: 35, carbSnack: 15, sodiumMeal: 600, satFatPct: 5, calorieDay: 1600, cholesterolDay: 200, yolksWeek: 3 };
const has = (table) => !!db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);

const [command, id, name] = process.argv.slice(2);

if (command === 'list') {
  const rows = db.all('SELECT id, name FROM profiles ORDER BY createdAt');
  if (!rows.length) console.log('No profiles. Add one with: node scripts/profile.cjs add <id> "<name>"');
  for (const row of rows) {
    const built = has('custom_meals') ? db.get('SELECT count(*) AS c FROM custom_meals WHERE profileId = ? AND deletedAt IS NULL', [row.id]).c : 0;
    const eaten = has('meal_log') ? db.get('SELECT count(*) AS c FROM meal_log WHERE profileId = ?', [row.id]).c : 0;
    console.log(`${row.id.padEnd(10)} ${String(row.name).padEnd(16)} built meals: ${String(built).padEnd(4)} logged: ${eaten}`);
  }
} else if (command === 'add') {
  if (!/^[a-z0-9-]+$/.test(id ?? '') || !name) {
    console.error('usage: add <id> "<display name>"   (id: lowercase letters, digits, dashes)');
    process.exit(1);
  }
  const now = new Date().toISOString();
  db.run('INSERT INTO profiles (id, name, rules, rulesUpdatedAt, createdAt) VALUES (?, ?, ?, ?, ?)', [id, name, JSON.stringify(DEFAULT_RULES), now, now]);
  console.log(`created ${id} (${name})`);
} else if (command === 'rename') {
  if (!id || !name) { console.error('usage: rename <id> "<display name>"'); process.exit(1); }
  db.run('UPDATE profiles SET name = ? WHERE id = ?', [name, id]);
  console.log(`renamed ${id} to ${name}`);
} else {
  console.error('usage: list | add <id> "<name>" | rename <id> "<name>"');
  process.exit(1);
}
db.close();
