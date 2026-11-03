/**
 * Calendar days as "YYYY-MM-DD" strings in local time - the phone's day,
 * which on the Pi is the same time zone. Never `new Date("YYYY-MM-DD")`:
 * that parses as UTC midnight and lands on the previous day in America.
 */

export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date): DayKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const addDays = (key: DayKey, n: number): DayKey => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** The local day an ISO timestamp falls on. */
export const keyOfIso = (iso: string): DayKey => dayKey(new Date(iso));

export const isDayKey = (v: unknown): v is DayKey => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayKey(fromKey(v)) === v;

export const weekdayShort = (key: DayKey) => fromKey(key).toLocaleDateString('en-US', { weekday: 'short' });
export const weekdayLong = (key: DayKey) => fromKey(key).toLocaleDateString('en-US', { weekday: 'long' });
export const monthDay = (key: DayKey) => fromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function dayName(key: DayKey, today: DayKey): string {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return weekdayLong(key);
}
