'use client';

/**
 * Ideas: one meal at a time that fits her plan right now, with "Another"
 * for the next one. Opens on the meal the clock suggests.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useData } from '@/components/DataProvider';
import { CarbMeter, Chips, Icon, Pairing, Plate, SaveButton, Segmented } from '@/components/ui';
import { FOODS, shortName } from '@/lib/foods';
import { daysAgo } from '@/lib/history';
import { usePref } from '@/lib/prefs';
import { MEAL_TYPES, mealTypeLabel, type MealType } from '@/lib/rules';
import { ideas, mealTypeAt } from '@/lib/suggest';

export default function IdeasPage() {
  const data = useData();
  const { state, meals, context, now, saved, pantry } = data;
  const [type, setType] = useState<MealType>(() => mealTypeAt(new Date()));
  const [index, setIndex] = useState(0);
  const [useHome, setUseHome] = usePref('use-home', false);

  const list = useMemo(
    () => (state ? ideas(meals, { type, rules: state.rules, context, pantry, useHome, log: state.log, now }) : []),
    [state, meals, type, context, pantry, useHome, now],
  );
  if (!state) return null;
  const idea = list.length ? list[index % list.length] : null;
  const word = mealTypeLabel(type).toLowerCase();

  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight">Meal ideas</h1>
      <Segmented label="Which meal" options={MEAL_TYPES} value={type} onChange={(t) => { setType(t); setIndex(0); }} />

      <button
        onClick={() => { setUseHome(!useHome); setIndex(0); }}
        role="switch"
        aria-checked={useHome}
        className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2 text-left"
      >
        <span className="flex flex-1 flex-col">
          <span className="text-base font-bold">Use what&apos;s at home</span>
          <span className="text-sm text-muted">Ideas that need fewer groceries first</span>
        </span>
        <span aria-hidden="true" className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${useHome ? 'bg-accent' : 'bg-line-strong'}`}>
          <span className={`absolute top-[3px] size-6 rounded-full bg-white shadow transition-[left] ${useHome ? 'left-[23px]' : 'left-[3px]'}`} />
        </span>
      </button>

      {idea ? (
        <article className="card flex flex-col gap-4 p-5" aria-label={`${mealTypeLabel(type)} idea`}>
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <span className="label">{mealTypeLabel(type)}{idea.meal.custom ? ' · your plate' : ''}</span>
              <h2 className="text-2xl font-bold leading-tight">{idea.meal.name}</h2>
            </div>
            <SaveButton saved={saved.has(idea.meal.id)} onToggle={() => data.setSaved(idea.meal.id, !saved.has(idea.meal.id))} />
          </div>
          <CarbMeter evaluation={idea.evaluation} />
          {type === 'snack' ? <Pairing items={idea.meal.items} /> : <Plate items={idea.meal.items} type={type} />}
          <Chips checks={idea.evaluation.checks} />
          <div className="flex items-center gap-2.5 border-t border-line-soft pt-3 text-[15px]">
            <Icon name="home" size={20} stroke={2} className="text-muted" />
            <span className="flex-1">
              {idea.missing.length ? `Need: ${idea.missing.map((i) => shortName(FOODS[i.food]).toLowerCase()).join(', ')}` : 'Everything is at home'}
            </span>
            {idea.meal.minutes && (
              <span className="flex items-center gap-1 whitespace-nowrap text-muted"><Icon name="clock" size={18} stroke={2} />{idea.meal.minutes} min</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button className="btn btn-secondary" onClick={() => setIndex(index + 1)} disabled={list.length < 2}>
              <Icon name="again" size={20} />Another
            </button>
            <Link className="btn btn-primary" href={`/meal/${idea.meal.id}`}>{type === 'snack' ? 'Details' : 'See recipe'}</Link>
          </div>
          <p className="-mt-1.5 text-center text-sm text-muted" aria-live="polite">Idea {(index % list.length) + 1} of {list.length} that fit</p>
        </article>
      ) : (
        <div className="card flex flex-col gap-2.5 px-5 py-7 text-center">
          <h2 className="text-[22px] font-bold">No {word} ideas fit right now</h2>
          <p className="text-muted">Every {word} is over one of her limits for today. Build one that fits, or check the limits on Her plan.</p>
          <Link className="btn btn-primary mt-1" href={`/build?type=${type}`}>Build a plate</Link>
        </div>
      )}

      <Today />
    </>
  );
}

function Today() {
  const { state, now, context } = useData();
  if (!state) return null;
  const today = state.log.filter((e) => daysAgo(e.eatenAt, now) === 0);
  return (
    <section className="card flex flex-col gap-3" aria-labelledby="today">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="today" className="label">Today so far</h2>
        <span className="text-sm text-muted">Cholesterol {Math.round(context.cholesterolToday)} of {state.rules.cholesterolDay} mg</span>
      </div>
      <ul className="grid grid-cols-4 gap-2">
        {MEAL_TYPES.map((t) => {
          const eaten = today.filter((e) => e.type === t.id);
          const done = eaten.length > 0;
          return (
            <li key={t.id} className="flex flex-col items-center gap-1.5 text-center">
              <span className={`flex size-10 items-center justify-center rounded-full ${done ? 'bg-accent text-white' : 'border-[1.5px] border-dashed border-line-strong'}`}>
                {done && <Icon name="ok" size={20} stroke={2.6} />}
              </span>
              <span className="text-[13px] font-bold">{t.label}</span>
              <span className="text-xs leading-tight text-muted">{done ? eaten[0].name.split(' ').slice(0, 2).join(' ') : 'Not yet'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
