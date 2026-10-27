'use client';

/** Saved meals, and what she ate - with this week's egg yolks at a glance. */

import Link from 'next/link';
import { useState } from 'react';

import { useData } from '@/components/DataProvider';
import { Icon, Segmented, TONE } from '@/components/ui';
import { groupByDay, timeLabel } from '@/lib/history';
import { evaluate, mealTypeLabel, totals } from '@/lib/rules';

export default function SavedPage() {
  const [view, setView] = useState<'saved' | 'history'>('saved');
  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight">Saved &amp; history</h1>
      <Segmented label="Saved or history" options={[{ id: 'saved', label: 'Saved' }, { id: 'history', label: 'History' }]} value={view} onChange={setView} />
      {view === 'saved' ? <Saved /> : <History />}
    </>
  );
}

function Saved() {
  const { state, saved, mealById, context } = useData();
  if (!state) return null;
  const meals = [...saved].map(mealById).filter((m) => m !== undefined);
  if (!meals.length) return <p className="py-6 text-center text-muted">Nothing saved yet. Tap the bookmark on any idea.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {meals.map((m) => {
        const e = evaluate(m.items, m.type, state.rules, context);
        return (
          <li key={m.id}>
            <Link href={`/meal/${m.id}`} className="card flex items-center gap-3.5 px-4 py-3.5">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${TONE[e.verdict.status]}`} title={e.verdict.text}>
                <Icon name={e.verdict.status} size={22} stroke={2.6} />
                <span className="sr-only">{e.verdict.text}</span>
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-bold">{m.name}</span>
                <span className="text-sm text-muted">{mealTypeLabel(m.type)} · {Math.round(e.totals.carbs)} g carbs{m.minutes ? ` · ${m.minutes} min` : ''}</span>
              </span>
              <Icon name="next" size={20} className="text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
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
