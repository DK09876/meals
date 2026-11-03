'use client';

/** What she ate, by day - with this week's egg yolks at a glance. */

import Link from 'next/link';

import { useData } from '@/components/DataProvider';
import { Icon } from '@/components/ui';
import { groupByDay, timeLabel } from '@/lib/history';
import { mealTypeLabel, totals } from '@/lib/rules';

export default function HistoryPage() {
  return (
    <>
      <Link href="/settings" className="-ml-1 flex min-h-11 items-center gap-1 self-start pr-3 text-[17px] font-bold text-accent"><Icon name="back" size={22} />Settings</Link>
      <h1 className="text-[30px] font-bold leading-tight">What she ate</h1>
      <History />
    </>
  );
}

function History() {
  const { state, now, context } = useData();
  if (!state) return null;
  const limit = state.rules.yolksWeek;
  const used = Math.round(context.yolksThisWeek);
  const days = groupByDay(state.log, now);
  return (
    <>
      <section className="card flex flex-col gap-2.5" aria-labelledby="yolks">
        <h2 id="yolks" className="label">Egg yolks, last 7 days</h2>
        <div className="flex items-center gap-2">
          {Array.from({ length: Math.max(limit, used) }, (_, n) => (
            <span key={n} aria-hidden="true" className={`size-7 rounded-full border-2 border-[#d9a441] ${n < used ? 'bg-[#d9a441]' : 'bg-surface'}`} />
          ))}
          <span className="ml-1.5 font-bold">{used} of {limit}</span>
        </div>
        <p className="text-sm text-muted">Her handout says 2 to 4 a week. Egg whites don&apos;t count.</p>
      </section>
      {!days.length && <p className="py-6 text-center text-muted">Nothing logged yet. Tap “She ate this” on a meal.</p>}
      {days.map((d) => (
        <section key={d.day} className="flex flex-col gap-2" aria-labelledby={`d-${d.day}`}>
          <h2 id={`d-${d.day}`} className="label">{d.day}</h2>
          <ul className="card px-4 py-1">
            {d.entries.map((entry, n) => (
              <li key={entry.id} className={n ? 'border-t border-line-soft' : ''}>
                <Link href={`/meal/${entry.mealId}`} className="flex min-h-15 items-center gap-3 py-2">
                  <span className="flex flex-1 flex-col">
                    <span className="font-bold">{entry.name}</span>
                    <span className="text-sm text-muted">{mealTypeLabel(entry.type)} · {Math.round(totals(entry.items).carbs)} g carbs</span>
                  </span>
                  <span className="text-sm text-muted">{timeLabel(entry.eatenAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
