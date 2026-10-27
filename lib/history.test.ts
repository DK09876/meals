import { describe, expect, it } from 'vitest';

import { contextFrom, dayLabel, daysAgo, groupByDay, type LogEntry } from './history';

const now = new Date(2026, 9, 27, 13, 0); // Tue 27 Oct 2026, 1pm local
const at = (day: number, hour = 8) => new Date(2026, 9, day, hour).toISOString();
const entry = (id: string, eatenAt: string, items: LogEntry['items']): LogEntry => ({ id, mealId: id, name: id, type: 'breakfast', items, eatenAt });

describe('days', () => {
  it('counts local days, not 24-hour spans', () => {
    expect(daysAgo(at(27, 0), now)).toBe(0);
    expect(daysAgo(at(26, 23), now)).toBe(1);
    expect(daysAgo(at(20), now)).toBe(7);
  });

  it('labels them the way a person would', () => {
    expect(dayLabel(at(27), now)).toBe('Today');
    expect(dayLabel(at(26), now)).toBe('Yesterday');
    expect(dayLabel(at(25), now)).toBe('Sunday');
    expect(dayLabel(at(12), now)).toBe('Oct 12');
  });
});

describe('contextFrom', () => {
  it("adds today's cholesterol and the last seven days' yolks", () => {
    const log = [
      entry('a', at(27), [{ food: 'greekyog', servings: 1 }]),
      entry('b', at(26), [{ food: 'egg', servings: 1 }]),
      entry('c', at(21), [{ food: 'egg', servings: 1 }]), // 6 days ago: still this week
      entry('d', at(20), [{ food: 'egg', servings: 1 }]), // 7 days ago: not
    ];
    expect(contextFrom(log, now)).toEqual({ cholesterolToday: 9, yolksThisWeek: 2 });
  });
});

describe('groupByDay', () => {
  it('puts the newest day first', () => {
    const groups = groupByDay([entry('a', at(26), []), entry('b', at(27, 9), []), entry('c', at(27, 18), [])], now);
    expect(groups.map((g) => [g.day, g.entries.map((e) => e.id)])).toEqual([['Today', ['c', 'b']], ['Yesterday', ['a']]]);
  });
});
