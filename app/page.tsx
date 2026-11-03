'use client';

/**
 * Her week: seven days from today, each with breakfast, lunch, dinner and a
 * snack. "Fill my week" plans every empty slot with meals that keep each day
 * and the week inside her limits; any slot can be swapped or emptied.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useData } from '@/components/DataProvider';
import LikePrompt from '@/components/LikePrompt';
import MealPhoto from '@/components/MealPhoto';
import Sheet from '@/components/Sheet';
import { Icon } from '@/components/ui';
import type { Meal } from '@/lib/catalog';
import { addDays, dayName, monthDay, weekdayShort, type DayKey } from '@/lib/dates';
import { useMode } from '@/lib/mode';
import { checkSlot, eatenFor, planned } from '@/lib/plan';
import { ranked } from '@/lib/rank';
import { MEAL_TYPES, mealTypeLabel, satFatBudget, totals, type MealType } from '@/lib/rules';

export default function WeekPage() {
  const data = useData();
  const { state, world, today, mealById, logMeal } = data;
  const grandma = useMode() === 'grandma';
  const [week, setWeek] = useState(0);
  const start = addDays(today, week * 7);
  const [picked, setPicked] = useState<DayKey | null>(null);
  const day = picked && picked >= start && picked < addDays(start, 7) ? picked : start;
  const [picker, setPicker] = useState<MealType | null>(null);
  const [liking, setLiking] = useState<Meal | null>(null);
  const [filling, setFilling] = useState(false);
  if (!state || !world) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const emptyCount = days.reduce((n, d) => n + MEAL_TYPES.filter((t) => !planned(world, d, t.id)).length, 0);

  // The day's totals: planned meals, or what she ate where nothing is planned.
  const dayTotals = MEAL_TYPES.reduce((acc, t) => {
    const p = planned(world, day, t.id);
    const meal = p && mealById(p.mealId);
    const items = meal ? meal.items : world.log.filter((e) => e.type === t.id && eatenFor([e], day, t.id)).flatMap((e) => e.items);
    const x = totals(items);
    return { chol: acc.chol + x.cholesterol, sat: acc.sat + x.satFat };
  }, { chol: 0, sat: 0 });

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[30px] font-bold leading-tight">{grandma ? 'Your week' : 'Her week'}</h1>
        <div className="flex gap-1.5">
          <button className="iconbtn" aria-label="Earlier week" disabled={week === 0} onClick={() => setWeek(week - 1)}><Icon name="back" size={20} /></button>
          <button className="iconbtn" aria-label="Next week" disabled={week >= 3} onClick={() => setWeek(week + 1)}><Icon name="next" size={20} /></button>
        </div>
      </div>

      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Days">
        {days.map((d) => {
          const on = d === day;
          const count = MEAL_TYPES.filter((t) => planned(world, d, t.id)).length;
          return (
            <li key={d}>
              <button
                onClick={() => setPicked(d)}
                aria-pressed={on}
                aria-label={`${dayName(d, today)}, ${count} of 4 planned`}
                className={`flex min-h-[72px] w-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] ${on ? 'border-accent bg-accent text-white' : 'border-line bg-surface'}`}
              >
                <span className="text-[13px] font-bold">{d === today ? 'Today' : weekdayShort(d)}</span>
                <span className="text-xl font-bold leading-none">{Number(d.slice(8))}</span>
                <span aria-hidden="true" className="flex gap-0.5 pt-0.5">
                  {MEAL_TYPES.map((t) => <span key={t.id} className={`size-1.5 rounded-full ${planned(world, d, t.id) ? (on ? 'bg-white' : 'bg-accent') : on ? 'bg-white/40' : 'bg-line-strong'}`} />)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="card flex flex-col gap-1 p-4" aria-label={dayName(day, today)}>
        <div className="flex items-baseline justify-between px-1 pb-1">
          <h2 className="text-xl font-bold">{dayName(day, today)}<span className="ml-2 text-base font-normal text-muted">{monthDay(day)}</span></h2>
        </div>
        {MEAL_TYPES.map((t) => {
          const p = planned(world, day, t.id);
          const meal = p && mealById(p.mealId);
          const eaten = eatenFor(state.log, day, t.id);
          if (!meal) {
            return (
              <button key={t.id} onClick={() => setPicker(t.id)} className="flex min-h-[76px] items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong px-3 text-left">
                <span className="flex size-14 items-center justify-center rounded-xl bg-field text-accent" aria-hidden="true"><Icon name="plus" size={26} /></span>
                <span className="flex flex-col">
                  <span className="label">{t.label}</span>
                  <span className="text-[17px] font-bold text-accent">{eaten ? `Had ${eaten.name}` : `Add ${t.label.toLowerCase()}`}</span>
                </span>
              </button>
            );
          }
          const canEat = day <= today && !eaten;
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
              <Link href={`/meal/${meal.id}?date=${day}&slot=${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <MealPhoto meal={meal} className="size-16 shrink-0" rounded="rounded-xl" />
                <span className="flex min-w-0 flex-col">
                  <span className="label">{t.label}</span>
                  <span className="text-[17px] font-bold leading-snug">{meal.name}</span>
                  <span className="text-sm text-muted">{Math.round(totals(meal.items).carbs)} g carbs{meal.minutes ? ` · ${meal.minutes} min` : ''}</span>
                </span>
              </Link>
              {eaten ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-ok-bg px-2.5 py-1.5 text-sm font-bold text-ok-fg"><Icon name="ok" size={16} stroke={2.6} />Eaten</span>
              ) : canEat ? (
                <button onClick={() => logMeal(meal, () => setLiking(meal))} className="shrink-0 rounded-xl border-[1.5px] border-accent px-3 py-2.5 text-[15px] font-bold text-accent">
                  {grandma ? 'I ate it' : 'She ate it'}
                </button>
              ) : null}
            </div>
          );
        })}
        <div className="mt-2 flex flex-col gap-2 border-t border-line-soft px-1 pt-3">
          <DayBar label="Cholesterol" value={Math.round(dayTotals.chol)} limit={state.rules.cholesterolDay} unit="mg" />
          <DayBar label="Saturated fat" value={Math.round(dayTotals.sat * 10) / 10} limit={satFatBudget(state.rules)} unit="g" />
        </div>
      </section>

      {emptyCount > 0 && (
        <button
          className="btn btn-primary"
          disabled={filling}
          onClick={async () => { setFilling(true); await data.fillWeek(start); setFilling(false); }}
        >
          <Icon name="wand" size={22} />{filling ? 'Planning…' : week === 0 ? 'Fill my week' : 'Fill this week'}
        </button>
      )}
      <p className="text-center text-sm text-muted">
        {emptyCount ? `${emptyCount} empty ${emptyCount === 1 ? 'slot' : 'slots'} this week. Every meal is checked against ${grandma ? 'your' : 'her'} limits.` : 'All planned. Tap a meal to read it or swap it.'}
      </p>
      {!grandma && <Link href="/history" className="text-center font-bold text-accent">What she ate</Link>}

      {picker && <SlotPicker date={day} slot={picker} onClose={() => setPicker(null)} />}
      {liking && <LikePrompt meal={liking} grandma={grandma} onClose={() => setLiking(null)} />}
    </>
  );
}

function DayBar({ label, value, limit, unit }: { label: string; value: number; limit: number; unit: string }) {
  const over = value > limit;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 font-bold">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-field" aria-hidden="true">
        <span className={`block h-full rounded-full ${over ? 'bg-fail-bar' : 'bg-accent'}`} style={{ width: `${Math.min(100, (value / limit) * 100)}%` }} />
      </span>
      <span className={`tabular w-24 shrink-0 text-right ${over ? 'font-bold text-fail-fg' : 'text-muted'}`}>{value} of {limit} {unit}</span>
    </div>
  );
}

/** Choosing a meal for an empty slot: the best ones that fit, then the full list. */
export function SlotPicker({ date, slot, onClose }: { date: DayKey; slot: MealType; onClose: () => void }) {
  const { world, meals, taste, today, setSlot } = useData();
  const options = useMemo(
    () => (world ? ranked(meals.filter((m) => m.type === slot), taste).filter((m) => checkSlot(world, date, slot, m).fits) : []),
    [world, meals, taste, date, slot],
  );
  if (!world) return null;
  return (
    <Sheet title={`${mealTypeLabel(slot)} for ${dayName(date, today).toLowerCase() === 'today' ? 'today' : dayName(date, today)}`} onClose={onClose}>
      {options.length === 0 && <p className="text-muted">Nothing fits this slot right now. The day may already be full on cholesterol or saturated fat.</p>}
      <ul className="flex flex-col gap-2">
        {options.slice(0, 6).map((m) => (
          <li key={m.id}>
            <button
              onClick={async () => { onClose(); await setSlot(date, slot, m.id); }}
              className="flex w-full items-center gap-3 rounded-2xl border border-line p-2 text-left"
            >
              <MealPhoto meal={m} className="size-16 shrink-0" rounded="rounded-xl" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[17px] font-bold leading-snug">{m.name}</span>
                <span className="text-sm text-muted">{Math.round(totals(m.items).carbs)} g carbs{m.minutes ? ` · ${m.minutes} min` : ''}{taste.likes.get(m.id) === 1 ? ' · ♥ favourite' : ''}</span>
              </span>
              <Icon name="plus" size={22} className="shrink-0 text-accent" />
            </button>
          </li>
        ))}
      </ul>
      <Link href={`/recipes?type=${slot}&date=${date}`} className="btn btn-secondary" onClick={onClose}>See all {mealTypeLabel(slot).toLowerCase()} recipes</Link>
    </Sheet>
  );
}
