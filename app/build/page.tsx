'use client';

/**
 * Build a plate: add foods group by group and watch the checks as you go.
 * A meal can only be saved once it fits her plan on its own.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useData } from '@/components/DataProvider';
import { CarbMeter, Chips, Icon, Segmented, Verdict } from '@/components/ui';
import { foodsIn, GROUPS } from '@/lib/foods';
import { fraction } from '@/lib/format';
import { evaluate, isMealType, MEAL_TYPES, type Item, type MealType } from '@/lib/rules';
import { mealTypeAt } from '@/lib/suggest';

export default function BuildPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return <Suspense><Build /></Suspense>;
}

function Build() {
  const params = useSearchParams();
  const router = useRouter();
  const data = useData();
  const { state, context } = data;
  const asked = params.get('type');
  const [type, setType] = useState<MealType>(isMealType(asked) ? asked : mealTypeAt(new Date()));
  const [plate, setPlate] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>('veg');
  const [busy, setBusy] = useState(false);
  if (!state) return null;

  const items: Item[] = Object.entries(plate).filter(([, q]) => q > 0).map(([food, servings]) => ({ food, servings }));
  const e = evaluate(items, type, state.rules, context);
  const empty = items.length === 0;
  const blocked = !empty && !e.fitsAnyDay;
  const set = (food: string, q: number) => setPlate((p) => ({ ...p, [food]: Math.max(0, Math.min(10, q)) }));

  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight">Build a plate</h1>
      <Segmented label="Meal or snack" options={MEAL_TYPES} value={type} onChange={setType} />

      {/* Only the meter and verdict stay pinned while scrolling the foods; the
          full list of checks would cover a third of a phone screen. */}
      <section className="card sticky top-[max(8px,env(safe-area-inset-top))] z-10 flex flex-col gap-3 shadow-sm" aria-label="How it adds up">
        <CarbMeter evaluation={e} big={false} empty={empty} />
        {empty
          ? <p className="text-[15px] text-muted">Add foods below. Checks appear as you go.</p>
          : <div aria-live="polite"><Verdict verdict={e.verdict} compact /></div>}
      </section>
      {!empty && <Chips checks={e.checks} />}

      {GROUPS.map((g) => {
        const foods = foodsIn(g.id);
        const added = foods.filter((f) => plate[f.id] > 0).length;
        const isOpen = open === g.id;
        return (
          <section key={g.id} className="card overflow-hidden p-0">
            <button onClick={() => setOpen(isOpen ? null : g.id)} aria-expanded={isOpen} className="flex min-h-15 w-full items-center gap-3 px-4.5 py-2.5 text-left">
              <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px]" style={{ background: g.color }} />
              <span className="flex flex-1 flex-col">
                <span className="font-bold">{g.label}</span>
                <span className="text-sm text-muted">{g.hint}</span>
              </span>
              {added > 0 && <span className="chip bg-accent-soft text-accent-ink">{added} added</span>}
              <Icon name="down" size={20} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <ul className="px-4.5 pb-1.5">
                {foods.map((f) => {
                  const q = plate[f.id] ?? 0;
                  return (
                    <li key={f.id} className="listrow">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold">{f.name}</span>
                        <span className="text-sm text-muted">{f.serving} · {Math.round(f.carbs * 10) / 10} g carbs</span>
                      </span>
                      {q > 0 && (
                        <>
                          <button className="step" onClick={() => set(f.id, q - 0.5)} aria-label={`Remove half a serving of ${f.name}`}><Icon name="minus" size={18} stroke={2.4} /></button>
                          <span className="tabular min-w-7 text-center font-bold" aria-label={`${fraction(q)} servings`}>{fraction(q)}</span>
                        </>
                      )}
                      <button
                        className={`step ${q > 0 ? '' : 'border-accent bg-accent text-white'}`}
                        onClick={() => set(f.id, q + (q === 0 ? 1 : 0.5))}
                        aria-label={q > 0 ? `Add half a serving of ${f.name}` : `Add ${f.name}`}
                      >
                        <Icon name="plus" size={18} stroke={2.4} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <div className="grid grid-cols-2 gap-2.5">
        <button className="btn btn-secondary" onClick={() => setPlate({})} disabled={empty}>Clear</button>
        <button
          className="btn btn-primary"
          disabled={empty || blocked || busy}
          onClick={async () => {
            setBusy(true);
            const meal = await data.addMeal(type, items);
            setBusy(false);
            if (meal) router.push(`/meal/${meal.id}`);
          }}
        >
          {busy ? 'Saving…' : 'Save meal'}
        </button>
      </div>
      {blocked && <p className="-mt-2 text-center text-sm text-muted">Fix the red checks to save it.</p>}
    </>
  );
}
