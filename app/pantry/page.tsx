'use client';

/** At home: tick what is in the kitchen, so ideas can lean on it. Receipt scanning comes later. */

import { useState } from 'react';

import { useData } from '@/components/DataProvider';
import { Icon } from '@/components/ui';
import { foodsIn, GROUPS } from '@/lib/foods';

export default function PantryPage() {
  const data = useData();
  const [search, setSearch] = useState('');
  if (!data.state) return null;
  const q = search.trim().toLowerCase();
  const groups = GROUPS.map((g) => ({ ...g, foods: foodsIn(g.id).filter((f) => !q || f.name.toLowerCase().includes(q)) })).filter((g) => g.foods.length);

  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight">At home</h1>

      <div className="card flex items-center gap-3.5 border-dashed bg-[#f9faf7]">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-field text-muted"><Icon name="receipt" size={22} stroke={2} /></span>
        <span className="flex flex-1 flex-col">
          <span className="font-bold">Scan a receipt</span>
          <span className="text-sm text-muted">Snap a grocery receipt and this list fills itself in.</span>
        </span>
        <span className="chip bg-field text-ink-2">Later</span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label">Find a food</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Try “spinach”"
          className="min-h-12 w-full rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 outline-none focus:border-accent"
        />
      </label>

      <p className="text-[15px] text-muted">{data.pantry.size} {data.pantry.size === 1 ? 'item' : 'items'} at home. Tap to check or uncheck.</p>

      {groups.map((g) => (
        <section key={g.id} className="card px-4.5 pb-1 pt-3.5" aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`} className="label mb-1 flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: g.color }} />
            {g.label}
          </h2>
          <ul>
            {g.foods.map((f) => {
              const on = data.pantry.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => data.setPantry(f.id, !on)}
                    className="flex min-h-13 w-full items-center gap-3.5 border-t border-line-soft text-left"
                  >
                    <span aria-hidden="true" className={`flex size-6.5 shrink-0 items-center justify-center rounded-lg border-2 text-white ${on ? 'border-accent bg-accent' : 'border-[#9aa39c] bg-surface'}`}>
                      {on && <Icon name="ok" size={16} stroke={3} />}
                    </span>
                    <span className="flex-1">{f.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="py-6 text-center text-muted">Nothing called “{search}”. Only foods from her handouts are listed.</p>}
    </>
  );
}
