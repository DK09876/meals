'use client';

/**
 * Her plan: the limits every idea is checked against, where each came from,
 * and the ones that are guesses until her dietitian confirms them.
 */

import { useData } from '@/components/DataProvider';
import { Stepper } from '@/components/ui';
import { RULE_KEYS, RULE_SETTINGS } from '@/lib/rules';

const NEVER = ['Organ meats', 'Fried food', 'Bacon', 'Sausage', 'Deli meats', 'Hot dogs', 'Butter', 'Full-fat cheese', 'Cream', 'Coconut oil', 'Pastries', 'Sugary drinks'];

export default function PlanPage() {
  const { state, saveRules } = useData();
  if (!state) return null;
  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight">Her plan</h1>
      <p className="text-muted">Every idea is checked against these. Change a number and the ideas update on every phone.</p>

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

      <section className="card flex flex-col gap-2.5" aria-labelledby="never">
        <h2 id="never" className="label">Never suggested</h2>
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
