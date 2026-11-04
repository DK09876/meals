'use client';

/**
 * One recipe: the photo, what goes on the plate, her numbers against her
 * limits, how to make it - and what to do with it: add it to her week, mark
 * it eaten, make it fit when it does not.
 *
 * Opened from the week (?date=&slot=) it is checked against that day, and can
 * be swapped or taken off. Opened from "Choosing lunch for Tuesday" (&pick=1)
 * its main button puts it there.
 */

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import AddToWeek from '@/components/AddToWeek';
import { useData, type SlotRefusal } from '@/components/DataProvider';
import LikePrompt from '@/components/LikePrompt';
import MakeItWork from '@/components/MakeItWork';
import MealPhoto from '@/components/MealPhoto';
import PhotoPicker from '@/components/PhotoPicker';
import Sheet from '@/components/Sheet';
import { Chips, Icon, Verdict } from '@/components/ui';
import { dayName, isDayKey } from '@/lib/dates';
import { FOODS } from '@/lib/foods';
import { itemLabel } from '@/lib/format';
import { useMode } from '@/lib/mode';
import { eatenFor, slotContext } from '@/lib/plan';
import { evaluate, isMealType, mealTypeLabel, satFatBudget, type Status } from '@/lib/rules';
import { makeItFit } from '@/lib/swaps';
import { avoidedFoods } from '@/lib/restrictions';

export default function MealPage() {
  return <Suspense><Recipe /></Suspense>;
}

function Recipe() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const data = useData();
  const { state, world, pantry, today, likes } = data;
  const grandma = useMode() === 'grandma';
  const [sheet, setSheet] = useState<'week' | 'like' | 'photo' | null>(null);
  const [refusal, setRefusal] = useState<SlotRefusal | null>(null);
  const meal = data.mealById(decodeURIComponent(id));
  if (!state || !world) return null;

  if (!meal) {
    return (
      <div className="card mt-6 flex flex-col gap-3 text-center">
        <h1 className="text-xl font-bold">That recipe is gone</h1>
        <p className="text-muted">It may have been deleted on another phone.</p>
        <Link href="/recipes" className="btn btn-primary">See recipes</Link>
      </div>
    );
  }

  const date = params.get('date');
  const slotParam = params.get('slot');
  const at = isDayKey(date) && isMealType(slotParam) ? { date, slot: slotParam } : null;
  const picking = !!at && params.get('pick') === '1';
  const checkDate = at?.date ?? today;
  const context = slotContext(world, checkDate, meal.type);
  const e = evaluate(meal.items, meal.type, state.rules, context);
  const fixes = e.fits ? [] : makeItFit(meal.items, meal.type, state.rules, context, 3, avoidedFoods(state.restrictions));
  const t = e.totals;
  const fav = likes.get(meal.id) === 1;
  const photo = state.photos[meal.id];
  const eatenHere = at ? eatenFor(state.log, at.date, at.slot) : null;
  const dayWord = (d: string) => (d === today ? 'today' : dayName(d, today));

  const cholAfter = Math.round(context.cholesterolToday + t.cholesterol);
  const satAfter = Math.round((context.satFatToday + t.satFat) * 10) / 10;
  const budget = satFatBudget(state.rules);
  const rows: Array<{ label: string; value: string; note: string; status?: Status }> = [
    { label: 'Carbs', value: `${Math.round(t.carbs)} g`, note: `limit ${e.limits.carbs} g`, status: Math.round(t.carbs) <= e.limits.carbs ? 'ok' : 'fail' },
    { label: 'Protein', value: `${Math.round(t.protein)} g`, note: t.pairedCarbs > 0 ? 'pairs the carbs' : '' },
    { label: 'Saturated fat', value: `${Math.round(t.satFat * 10) / 10} g`, note: `${dayWord(checkDate)} ${satAfter} of ${budget} g`, status: satAfter <= budget ? 'ok' : 'fail' },
    { label: 'Sodium', value: `${Math.round(t.sodium)} mg`, note: `limit ${e.limits.sodium} mg`, status: Math.round(t.sodium) <= e.limits.sodium ? 'ok' : 'fail' },
    { label: 'Cholesterol', value: `${Math.round(t.cholesterol)} mg`, note: `${dayWord(checkDate)} ${cholAfter} of ${state.rules.cholesterolDay} mg`, status: cholAfter <= state.rules.cholesterolDay ? 'ok' : 'fail' },
  ];
  const statusText = { ok: 'text-ok-fg', warn: 'text-warn-fg', fail: 'text-fail-fg' };

  const back = () => (window.history.length > 1 ? router.back() : router.push('/recipes'));
  const putHere = async (mealId: string) => {
    if (!at) return;
    const refused = await data.setSlot(at.date, at.slot, mealId, { weekStart: today });
    if (refused) setRefusal(refused);
    else router.push('/');
  };
  const applyFix = async (fix: (typeof fixes)[number]) => {
    const copy = await data.addMeal(meal.type, fix.items, {
      name: meal.name.includes('(adjusted)') ? meal.name : `${meal.name} (adjusted)`,
      steps: meal.steps, minutes: meal.minutes, note: `Adjusted to fit: ${fix.text.toLowerCase()}.`, source: 'fixed',
    });
    if (copy) router.replace(`/meal/${copy.id}${at ? `?date=${at.date}&slot=${at.slot}${picking ? '&pick=1' : ''}` : ''}`);
  };

  return (
    <>
      <button onClick={back} className="-ml-1 flex min-h-11 items-center gap-1 self-start pr-3 text-[17px] font-bold text-accent">
        <Icon name="back" size={22} />Back
      </button>

      <div className="relative">
        <MealPhoto meal={meal} className="aspect-[4/3] w-full" rounded="rounded-3xl" />
        {!grandma && (
          <button onClick={() => setSheet('photo')} className="absolute bottom-3 right-3 flex min-h-11 items-center gap-1.5 rounded-xl bg-white/95 px-3 text-[15px] font-bold shadow">
            <Icon name="camera" size={18} />{photo ? 'Change photo' : 'Add photo'}
          </button>
        )}
      </div>
      {photo?.credit && (
        <p className="-mt-2.5 text-xs text-muted">
          Photo: {photo.page ? <a href={photo.page} target="_blank" rel="noreferrer" className="underline">{photo.credit}</a> : photo.credit}{photo.license ? `, ${photo.license}` : ''}
        </p>
      )}

      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <span className="label">{mealTypeLabel(meal.type)}{meal.minutes ? ` · ${meal.minutes} min` : ''}</span>
          <h1 className="text-[28px] font-bold leading-tight">{meal.name}</h1>
        </div>
        <button
          onClick={() => data.setLike(meal.id, fav ? 0 : 1)}
          aria-pressed={fav}
          aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
          className={`iconbtn size-12 ${fav ? 'border-[#c0392b] text-[#c0392b]' : 'text-ink'}`}
        >
          <Icon name="heart" size={24} stroke={2} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {at && (
        <p className="-mt-2 text-[15px] text-muted">
          {mealTypeLabel(at.slot)} on {dayWord(at.date)}{eatenHere ? ' · eaten ✓' : ''}
        </p>
      )}

      <Verdict verdict={e.verdict} />
      <Chips checks={e.checks} />
      {meal.note && <p className="text-[15px] text-muted">{meal.note}</p>}

      {fixes.length > 0 && (
        <section className="card flex flex-col gap-3 border-accent/40" aria-labelledby="fit">
          <h2 id="fit" className="flex items-center gap-2 text-lg font-bold"><Icon name="wand" size={22} className="text-accent" />Make it fit</h2>
          <ul className="flex flex-col gap-2">
            {fixes.map((f) => (
              <li key={f.text}>
                <button onClick={() => applyFix(f)} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left">
                  <span className="flex-1 font-bold">{f.text}</span>
                  <span className="shrink-0 text-sm font-bold text-accent">Use this</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Saves an adjusted copy; the original stays as it is.</p>
        </section>
      )}

      {/* Main actions */}
      <div className="flex flex-col gap-2.5">
        {picking ? (
          <button className="btn btn-primary" disabled={!e.fits} onClick={() => putHere(meal.id)}>
            <Icon name="plus" size={22} />Have it for {mealTypeLabel(at!.slot).toLowerCase()} {dayWord(at!.date)}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setSheet('week')}>
            <Icon name="calendar" size={22} />Add to {grandma ? 'my' : 'her'} week
          </button>
        )}
        {(!at || (at.date <= today && !eatenHere)) && (
          <button className="btn btn-secondary" onClick={() => data.logMeal(meal, () => setSheet('like'))}>
            <Icon name="ok" size={22} stroke={2.4} />{grandma ? 'I ate this' : 'She ate this'}
          </button>
        )}
        {at && !picking && (
          <div className="grid grid-cols-2 gap-2.5">
            <Link className="btn btn-secondary" href={`/recipes?type=${at.slot}&date=${at.date}`}>Swap</Link>
            <button className="btn btn-secondary" onClick={async () => { await data.setSlot(at.date, at.slot, null); router.push('/'); }}>Take off</button>
          </div>
        )}
      </div>

      <section className="card flex flex-col" aria-labelledby="plate">
        <h2 id="plate" className="label mb-1.5">What goes on the plate</h2>
        <ul>
          {meal.items.map((item, n) => {
            const home = pantry.has(item.food) || FOODS[item.food].group === 'extra';
            return (
              <li key={`${item.food}-${n}`} className="listrow">
                <span className="flex flex-1 flex-col">
                  <span className="text-[17px] font-bold">{itemLabel(item)}</span>
                  {!grandma && <span className={`text-sm ${home ? 'text-muted' : 'text-fail-fg'}`}>{home ? 'At home' : 'Need to buy'}</span>}
                </span>
                <span className="tabular whitespace-nowrap text-[15px] text-muted">{Math.round(FOODS[item.food].carbs * item.servings)} g carbs</span>
              </li>
            );
          })}
        </ul>
      </section>

      {meal.steps.length > 0 && (
        <section className="card flex flex-col gap-3" aria-labelledby="steps">
          <h2 id="steps" className="label">How to make it</h2>
          <ol className="flex flex-col gap-3">
            {meal.steps.map((step, n) => (
              <li key={n} className="flex gap-3 text-[17px]">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent-ink">{n + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card flex flex-col" aria-labelledby="numbers">
        <h2 id="numbers" className="label mb-1.5">{grandma ? 'Your numbers' : 'Her numbers'}</h2>
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

      {!grandma && meal.custom && (
        <button
          className="btn btn-secondary text-fail-fg"
          onClick={async () => {
            if (!window.confirm(`Delete "${meal.name}"? What she already ate stays in her history.`)) return;
            await data.deleteMeal(meal.id);
            router.push('/recipes');
          }}
        >
          <Icon name="trash" size={20} />Delete this recipe
        </button>
      )}
      <p className="text-center text-[13px] text-muted">Guidelines from her handouts, not medical advice.</p>

      {sheet === 'week' && <AddToWeek meal={meal} onClose={() => setSheet(null)} />}
      {sheet === 'like' && <LikePrompt meal={meal} grandma={grandma} onClose={() => setSheet(null)} />}
      {sheet === 'photo' && <PhotoPicker meal={meal} onClose={() => setSheet(null)} />}
      {refusal && at && (
        <Sheet title="That doesn't fit that day" onClose={() => setRefusal(null)}>
          <p className="-mt-2 text-muted">{refusal.error}</p>
          <MakeItWork date={at.date} slot={at.slot} meal={meal} onDone={() => { setRefusal(null); router.push('/'); }} />
        </Sheet>
      )}
    </>
  );
}
