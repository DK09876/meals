'use client';

/**
 * "Add to my week": the next seven days for this meal's slot, each marked
 * whether it fits that day. A day where it would break a limit opens the ways
 * to make it work: change the recipe, change another meal that day or later
 * in the week, another day, or another meal (components/MakeItWork.tsx).
 */

import { useState } from 'react';

import { useData } from './DataProvider';
import MakeItWork from './MakeItWork';
import Sheet from './Sheet';
import { useToast } from './Toast';
import { Icon } from './ui';
import type { Meal } from '@/lib/catalog';
import { addDays, dayName, monthDay, type DayKey } from '@/lib/dates';
import { checkSlot, planned } from '@/lib/plan';
import { mealTypeLabel } from '@/lib/rules';

export default function AddToWeek({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { world, today, mealById, setSlot } = useData();
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
              {open === d && <MakeItWork date={d} slot={slot} meal={meal} onDone={onClose} />}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
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
