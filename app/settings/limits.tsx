'use client';

/**
 * Her plan: the limits every idea is checked against, where each came from,
 * and the ones that are guesses until her dietitian confirms them.
 */

import { useData } from '@/components/DataProvider';
import { Icon, Stepper } from '@/components/ui';
import { AVOID_OPTIONS } from '@/lib/restrictions';
import { RULE_KEYS, RULE_SETTINGS, satFatBudget } from '@/lib/rules';

const NEVER = ['Organ meats', 'Fried food', 'Bacon', 'Sausage', 'Deli meats', 'Hot dogs', 'Butter', 'Full-fat cheese', 'Cream', 'Coconut oil', 'Pastries', 'Sugary drinks'];

export default function Limits() {
  const { state, saveRules } = useData();
  if (!state) return null;
  return (
    <>
      <h2 className="text-[22px] font-bold">Her limits</h2>
      <p className="-mt-2 text-muted">Every meal is checked against these. A change shows on every phone.</p>

      <section className="card px-4.5 py-1" aria-label="Limits">
        <ul>
          {RULE_KEYS.map((key) => {
            const s = RULE_SETTINGS[key];
            const value = state.rules[key];
            const shown = `${value}${s.unit ? ` ${s.unit}` : ''}`;
            return (
              <li key={key} className="flex items-center gap-2.5 border-b border-line-soft py-3.5">
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="font-bold">{s.label}</span>
                  <span className={`chip px-2.5 py-0.5 text-[13px] ${s.confirmed ? 'bg-ok-bg text-ok-fg' : 'bg-warn-bg text-warn-fg'}`}>{s.source}</span>
                  {key === 'satFatPct' && <span className="text-sm text-muted">About {satFatBudget(state.rules)} g a day at {state.rules.calorieDay} kcal</span>}
                  {key === 'calorieDay' && <span className="text-sm text-muted">Only used to work out her saturated fat in grams</span>}
                </span>
                <Stepper
                  value={shown}
                  decLabel={`Lower ${s.label.toLowerCase()}, now ${shown}`}
                  incLabel={`Raise ${s.label.toLowerCase()}, now ${shown}`}
                  decDisabled={value - s.step < s.min}
                  incDisabled={value + s.step > s.max}
                  onDec={() => saveRules({ [key]: value - s.step })}
                  onInc={() => saveRules({ [key]: value + s.step })}
                />
              </li>
            );
          })}
          <li className="flex flex-col items-start gap-1 py-3.5">
            <span className="font-bold">Every carb gets a protein or fat</span>
            <span className="text-[15px] text-muted">Apple with peanut butter, toast with egg. Always on.</span>
            <span className="chip bg-ok-bg px-2.5 py-0.5 text-[13px] text-ok-fg">Her care team</span>
          </li>
        </ul>
      </section>

      <NeverUse />

      <section className="card flex flex-col gap-2.5" aria-labelledby="never">
        <h2 id="never" className="label">Never suggested (her handout)</h2>
        <ul className="flex flex-wrap gap-2">
          {NEVER.map((n) => <li key={n} className="chip bg-[#f1f2ee] font-normal text-[#3a423d]">{n}</li>)}
        </ul>
        <p className="text-sm text-muted">From her cholesterol handout. Where the diabetes sheet allows a food the cholesterol sheet limits, the stricter rule wins.</p>
      </section>

      <section className="card flex flex-col gap-1.5" aria-labelledby="veg">
        <h2 id="veg" className="label">Non-starchy veggies</h2>
        <p>Unlimited. Still counted as 5 g carbs per cup raw or ½ cup cooked, as her handout does, so the totals stay honest.</p>
      </section>

      <p className="text-center text-[13px] text-muted">These numbers come from her handouts and are guidelines, not medical advice. Ask her dietitian to confirm the ones marked “please confirm”.</p>
    </>
  );
}

/** Foods she never has, and caffeine - hard rules, changed here by the family. */
function NeverUse() {
  const { state, saveRules, ruledOutMeals } = useData();
  if (!state) return null;
  const r = state.restrictions;
  const toggle = (id: string) => saveRules({}, { ...r, avoid: r.avoid.includes(id) ? r.avoid.filter((a) => a !== id) : [...r.avoid, id] });
  return (
    <section className="card flex flex-col gap-3" aria-labelledby="neveruse">
      <h2 id="neveruse" className="text-lg font-bold">Never use</h2>
      <p className="-mt-1.5 text-[15px] text-muted">Never suggested, planned or used in chat. Recipes that only use one as a side swap it for something similar and say so.</p>
      <ul className="flex flex-wrap gap-2">
        {AVOID_OPTIONS.map((o) => {
          const on = r.avoid.includes(o.id);
          return (
            <li key={o.id}>
              <button onClick={() => toggle(o.id)} aria-pressed={on} className={`flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[15px] font-bold ${on ? 'border-fail-fg bg-fail-bg text-fail-fg' : 'border-line bg-surface text-ink'}`}>
                {on && <Icon name="fail" size={16} stroke={2.8} />}{o.label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
        <span className="flex flex-col">
          <span className="font-bold">No caffeine</span>
          <span className="text-sm text-muted">No coffee, black or green tea, cola or chocolate in chat. Herbal tea and decaf are fine.</span>
        </span>
        <button
          role="switch"
          aria-checked={r.noCaffeine}
          aria-label="No caffeine"
          onClick={() => saveRules({}, { ...r, noCaffeine: !r.noCaffeine })}
          className={`relative h-[30px] w-[50px] shrink-0 rounded-full ${r.noCaffeine ? 'bg-accent' : 'bg-line-strong'}`}
        >
          <span className={`absolute top-[3px] size-6 rounded-full bg-white shadow ${r.noCaffeine ? 'left-[23px]' : 'left-[3px]'}`} />
        </button>
      </div>
      {ruledOutMeals.length > 0 && <p className="text-sm text-muted">Not offered now: {ruledOutMeals.map((m) => m.meal.name).join(', ')}.</p>}
    </section>
  );
}
