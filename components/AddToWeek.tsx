'use client';

/**
 * "Add to my week": the next seven days for this meal's slot, each marked
 * whether it fits that day. A day where it would break a limit opens what to
 * have there instead - meals that do fit, favourites first.
 */

import { useState } from 'react';

import { useData } from './DataProvider';
import MealPhoto from './MealPhoto';
import Sheet from './Sheet';
import { useToast } from './Toast';
import { Icon } from './ui';
import type { Meal } from '@/lib/catalog';
import { addDays, dayName, monthDay, type DayKey } from '@/lib/dates';
import { alternatives, checkSlot, planned } from '@/lib/plan';
import { mealTypeLabel, totals } from '@/lib/rules';

export default function AddToWeek({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { world, meals, taste, today, mealById, setSlot } = useData();
  const toast = useToast();
  const [open, setOpen] = useState<DayKey | null>(null);
  if (!world) return null;
  const slot = meal.type;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const place = async (date: DayKey, m: Meal) => {
    const refused = await setSlot(date, slot, m.id, { weekStart: today });
    if (!refused) {
      toast(`${m.name} is on ${dayName(date, today).toLowerCase() === 'today' ? 'today' : dayName(date, today)}'s ${mealTypeLabel(slot).toLowerCase()}.`);
      onClose();
    }
  };

  return (
    <Sheet title={`Add to ${mealTypeLabel(slot).toLowerCase()}`} onClose={onClose}>
      <p className="-mt-2 text-muted">{meal.name}</p>
      <ul className="flex flex-col gap-2">
        {days.map((d) => {
          const current = planned(world, d, slot);
          const currentMeal = current && mealById(current.mealId);
          const evaluation = checkSlot(world, d, slot, meal);
          const already = current?.mealId === meal.id;
          const fail = evaluation.checks.find((c) => c.status === 'fail');
          return (
            <li key={d} className="flex flex-col gap-2">
              <button
                onClick={() => (already ? onClose() : evaluation.fits ? place(d, meal) : setOpen(open === d ? null : d))}
                aria-expanded={!evaluation.fits ? open === d : undefined}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-2 text-left ${evaluation.fits ? 'border-line' : 'border-fail-fg/30 bg-fail-bg/40'}`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{dayName(d, today)} <span className="font-normal text-muted">{monthDay(d)}</span></span>
                  <span className="text-sm text-muted">{already ? 'Already planned' : currentMeal ? `Now: ${currentMeal.name}` : 'Empty'}</span>
                </span>
                {evaluation.fits ? (
                  <span className="flex items-center gap-1 text-sm font-bold text-ok-fg"><Icon name="ok" size={18} stroke={2.6} />{already ? 'Planned' : currentMeal ? 'Swap in' : 'Fits'}</span>
                ) : (
                  <span className="flex max-w-[45%] items-center gap-1 text-right text-sm font-bold text-fail-fg"><Icon name="fail" size={18} stroke={2.6} />{fail ? shortReason(fail.text) : 'Over'}</span>
                )}
              </button>
              {open === d && <Instead world={world} date={d} meal={meal} onPick={(m) => place(d, m)} />}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );

  function Instead({ world: w, date, meal: m, onPick }: { world: NonNullable<typeof world>; date: DayKey; meal: Meal; onPick: (m: Meal) => void }) {
    const alt = alternatives(w, meals, taste, date, slot, m, today);
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-field/60 p-3">
        <p className="text-[15px] font-bold">{alt.instead.length ? 'That day is full. Have one of these instead:' : 'Nothing fits that day. Try another day.'}</p>
        {alt.instead.map((x) => (
          <button key={x.id} onClick={() => onPick(x)} className="flex items-center gap-3 rounded-xl bg-surface p-2 text-left">
            <MealPhoto meal={x} className="size-12 shrink-0" rounded="rounded-lg" />
            <span className="flex flex-1 flex-col">
              <span className="font-bold leading-snug">{x.name}</span>
              <span className="text-sm text-muted">{Math.round(totals(x.items).carbs)} g carbs</span>
            </span>
            <Icon name="plus" size={20} className="text-accent" />
          </button>
        ))}
      </div>
    );
  }
}

/** "Over the cholesterol for today" → "Cholesterol", for a narrow column. */
function shortReason(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('cholesterol')) return 'Too much cholesterol';
  if (t.includes('saturated')) return 'Too much sat. fat';
  if (t.includes('yolk')) return 'Too many egg yolks';
  if (t.includes('carb')) return 'Too many carbs';
  if (t.includes('sodium')) return 'Too salty';
  return 'Over a limit';
}
