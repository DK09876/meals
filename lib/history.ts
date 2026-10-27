/**
 * What she has eaten, and what it means for the checks that look back:
 * cholesterol today, egg yolks over the last seven days.
 *
 * Days are the phone's local days. Each log entry keeps a copy of the meal's
 * items, so deleting a built meal later does not rewrite what she ate.
 */

import type { Context, Item, MealType } from './rules';
import { totals } from './rules';

export interface LogEntry {
  id: string;
  mealId: string;
  name: string;
  type: MealType;
  items: Item[];
  eatenAt: string;
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole local days between then and now: 0 today, 1 yesterday. Rounded, so a DST night is still one day. */
export function daysAgo(iso: string, now: Date): number {
  return Math.round((midnight(now) - midnight(new Date(iso))) / 86_400_000);
}

/** "This week" for egg yolks is the last seven days, today included - not since Monday. */
export const WEEK_DAYS = 7;

export function contextFrom(log: LogEntry[], now: Date): Context {
  let cholesterolToday = 0;
  let yolksThisWeek = 0;
  for (const entry of log) {
    const ago = daysAgo(entry.eatenAt, now);
    if (ago < 0 || ago >= WEEK_DAYS) continue;
    const t = totals(entry.items);
    if (ago === 0) cholesterolToday += t.cholesterol;
    yolksThisWeek += t.yolks;
  }
  return { cholesterolToday, yolksThisWeek };
}

export function dayLabel(iso: string, now: Date): string {
  const ago = daysAgo(iso, now);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  const date = new Date(iso);
  if (ago > 1 && ago < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Newest first, grouped under day labels. */
export function groupByDay(log: LogEntry[], now: Date): Array<{ day: string; entries: LogEntry[] }> {
  const groups: Array<{ day: string; entries: LogEntry[] }> = [];
  for (const entry of [...log].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))) {
    const day = dayLabel(entry.eatenAt, now);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}
