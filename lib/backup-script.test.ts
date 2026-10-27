/**
 * Runs the real scripts/backup.sh against a throwaway database. Needs the
 * sqlite3 command-line tool, as the Pi has; CI installs it.
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const hasSqlite = (() => { try { execFileSync('sqlite3', ['-version']); return true; } catch { return false; } })();
let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'meals-backup-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const run = (...args: string[]) => execFileSync('bash', ['scripts/backup.sh', ...args], {
  env: { ...process.env, MEALS_DB_PATH: join(dir, 'meals.db'), MEALS_BACKUP_DIR: join(dir, 'out'), MEALS_BACKUP_KEEP: '2' },
  encoding: 'utf8',
});
const sql = (q: string) => execFileSync('sqlite3', [join(dir, 'meals.db'), q]);
const snapshots = () => readdirSync(join(dir, 'out')).filter((f) => f.endsWith('.db.gz'));

describe.skipIf(!hasSqlite)('backup.sh', () => {
  beforeEach(() => {
    sql('CREATE TABLE profiles (id TEXT); CREATE TABLE meal_log (id TEXT); INSERT INTO profiles VALUES (\'grandma\');');
  });

  it('snapshots, verifies, and skips when nothing changed', () => {
    expect(run('--verify')).toMatch(/integrity=ok profiles=1 logged=0/);
    expect(run()).toMatch(/unchanged/);
    expect(snapshots()).toHaveLength(1);
  });

  it('keeps only the newest few', () => {
    run();
    for (const n of [1, 2]) { sql(`INSERT INTO meal_log VALUES ('${n}')`); run('--force'); }
    expect(snapshots()).toHaveLength(2);
  });

  it('fails loudly without a database', () => {
    rmSync(join(dir, 'meals.db'));
    expect(() => run()).toThrow();
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });
});
