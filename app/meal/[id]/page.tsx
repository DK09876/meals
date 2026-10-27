'use client';

/**
 * One meal: what goes on the plate, her numbers against her limits, how to
 * make it, and "She ate this".
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { useData } from '@/components/DataProvider';
import { Icon, SaveButton, Verdict } from '@/components/ui';
import { FOODS } from '@/lib/foods';
import { itemLabel } from '@/lib/format';
import { daysAgo } from '@/lib/history';
import { evaluate, mealTypeLabel, satFatBudget, type Status } from '@/lib/rules';

export default function MealPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useData();
  const { state, context, saved, pantry, now } = data;
  const meal = data.mealById(decodeURIComponent(id));
  if (!state) return null;

  const back = () => (window.history.length > 1 ? router.back() : router.push('/'));

  if (!meal) {
    return (
      <div className="card mt-6 flex flex-col gap-3 text-center">
        <h1 className="text-xl font-bold">That meal is gone</h1>
        <p className="text-muted">It may have been deleted on another phone.</p>
        <Link href="/" className="btn btn-primary">Back to ideas</Link>
      </div>
    );
  }

  const e = evaluate(meal.items, meal.type, state.rules, context);
  const t = e.totals;
  const cholAfter = Math.round(context.cholesterolToday + t.cholesterol);
  const satAfter = Math.round((context.satFatToday + t.satFat) * 10) / 10;
  const satBudget = satFatBudget(state.rules);
  const rows: Array<{ label: string; value: string; note: string; status?: Status }> = [
    { label: 'Carbs', value: `${Math.round(t.carbs)} g`, note: `limit ${e.limits.carbs} g`, status: Math.round(t.carbs) <= e.limits.carbs ? 'ok' : 'fail' },
    { label: 'Protein', value: `${Math.round(t.protein)} g`, note: t.pairedCarbs > 0 ? 'pairs the carbs' : '' },
    { label: 'Fat', value: `${Math.round(t.fat)} g`, note: '' },
    { label: 'Saturated fat', value: `${Math.round(t.satFat * 10) / 10} g`, note: `today ${satAfter} of ${satBudget} g`, status: satAfter <= satBudget ? 'ok' : 'fail' },
    { label: 'Sodium', value: `${Math.round(t.sodium)} mg`, note: `limit ${e.limits.sodium} mg`, status: Math.round(t.sodium) <= e.limits.sodium ? 'ok' : 'fail' },
    { label: 'Cholesterol', value: `${Math.round(t.cholesterol)} mg`, note: `today ${cholAfter} of ${state.rules.cholesterolDay} mg`, status: cholAfter <= state.rules.cholesterolDay ? 'ok' : 'fail' },
  ];
  const statusText = { ok: 'text-ok-fg', warn: 'text-warn-fg', fail: 'text-fail-fg' };
  const loggedToday = state.log.some((x) => x.mealId === meal.id && daysAgo(x.eatenAt, now) === 0);

  return (
    <>
      <button onClick={back} className="-ml-1 flex min-h-11 items-center gap-1 self-start pr-3 text-[17px] font-bold text-accent">
        <Icon name="back" size={22} />Back
      </button>
      <div className="flex flex-col gap-1.5">
        <span className="label">{mealTypeLabel(meal.type)}{meal.minutes ? ` · ${meal.minutes} min` : ''}{meal.custom ? ' · your plate' : ''}</span>
        <div className="flex items-start gap-3">
          <h1 className="flex-1 text-[28px] font-bold leading-tight">{meal.name}</h1>
          <SaveButton saved={saved.has(meal.id)} onToggle={() => data.setSaved(meal.id, !saved.has(meal.id))} />
        </div>
      </div>
      <Verdict verdict={e.verdict} />
      {meal.note && <p className="text-[15px] text-muted">{meal.note}</p>}

      <section className="card flex flex-col" aria-labelledby="plate">
        <h2 id="plate" className="label mb-1.5">What goes on the plate</h2>
        <ul>
          {meal.items.map((item) => {
            const home = pantry.has(item.food) || FOODS[item.food].group === 'extra';
            return (
              <li key={item.food} className="listrow">
                <span className="flex flex-1 flex-col">
                  <span className="font-bold">{itemLabel(item)}</span>
                  <span className={`text-sm ${home ? 'text-muted' : 'text-fail-fg'}`}>{home ? 'At home' : 'Need to buy'}</span>
                </span>
                <span className="tabular whitespace-nowrap text-[15px] text-muted">{Math.round(FOODS[item.food].carbs * item.servings)} g carbs</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card flex flex-col" aria-labelledby="numbers">
        <h2 id="numbers" className="label mb-1.5">Her numbers</h2>
        <dl>
          {rows.map((r) => (
            <div key={r.label} className="listrow">
              <dt className="flex-1">{r.label}</dt>
              <dd className="flex flex-col items-end">
                <span className={`tabular flex items-center gap-1.5 font-bold ${r.status ? statusText[r.status] : ''}`}>
                  {r.status && <Icon name={r.status} size={18} stroke={2.6} />}
                  {r.value}
                </span>
                {r.note && <span className="text-[13px] text-muted">{r.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {meal.steps.length > 0 && (
        <section className="card flex flex-col gap-2.5" aria-labelledby="steps">
          <h2 id="steps" className="label">How to make it</h2>
          <ol className="flex flex-col gap-2.5">
            {meal.steps.map((step, n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[15px] font-bold text-accent-ink">{n + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <button className="btn btn-primary" onClick={() => data.logMeal(meal)}>
        <Icon name="ok" size={22} stroke={2.4} />
        {loggedToday ? 'She ate this again' : 'She ate this'}
      </button>
      {meal.custom && (
        <button
          className="btn btn-secondary text-fail-fg"
          onClick={async () => {
            if (!window.confirm(`Delete "${meal.name}"? What she already ate stays in her history.`)) return;
            await data.deleteMeal(meal.id);
            router.push('/saved');
          }}
        >
          <Icon name="trash" size={20} />Delete this meal
        </button>
      )}
      <p className="text-center text-[13px] text-muted">Guidelines from her handouts, not medical advice.</p>
    </>
  );
}
