/**
 * The small pieces every screen shares, drawn as in the approved mock:
 * a segmented control, the carb meter, check chips, the verdict line and the
 * plate. A check always shows an icon and words, never colour alone.
 */

import { FOODS, shortName } from '@/lib/foods';
import type { Check, Evaluation, Item, MealType, Status } from '@/lib/rules';

// --- icons -----------------------------------------------------------------

const PATHS = {
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  warn: 'M12 6.5v7M12 17.5v.5',
  fail: 'M7 7l10 10M17 7L7 17',
  bookmark: 'M7 4h10v16l-5-3.5L7 20z',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  plus: 'M12 6v12M6 12h12',
  minus: 'M6 12h12',
  again: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  home: 'M4 11l8-7 8 7M6 10v10h12V10',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  plate: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 3.5v17M12 12h8.5',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, stroke = 2.2, fill = 'none', className }: { name: IconName; size?: number; stroke?: number; fill?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}

export const TONE: Record<Status, string> = {
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  fail: 'bg-fail-bg text-fail-fg',
};

// --- controls --------------------------------------------------------------

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid gap-1 rounded-2xl bg-field p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === value}
          className={`min-h-11 rounded-xl text-[15px] font-bold transition-colors ${o.id === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onDec, onInc, decLabel, incLabel, decDisabled, incDisabled }: { value: string; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; decDisabled?: boolean; incDisabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onDec} disabled={decDisabled} aria-label={decLabel} className="step"><Icon name="minus" size={18} stroke={2.4} /></button>
      <span className="tabular min-w-16 text-center font-bold">{value}</span>
      <button onClick={onInc} disabled={incDisabled} aria-label={incLabel} className="step"><Icon name="plus" size={18} stroke={2.4} /></button>
    </div>
  );
}

// --- checks ----------------------------------------------------------------

export function CarbMeter({ evaluation, big = true, empty = false }: { evaluation: Evaluation; big?: boolean; empty?: boolean }) {
  const carbs = Math.round(evaluation.totals.carbs);
  const limit = evaluation.limits.carbs;
  const over = carbs > limit;
  const pct = empty ? 0 : Math.min(100, (carbs / limit) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className={`tabular font-bold leading-none ${big ? 'text-[40px]' : 'text-[34px]'}`}>{carbs}</span>
        <span className="font-bold">g carbs</span>
        <span className="ml-auto text-[15px] text-muted">limit {limit} g</span>
      </div>
      <div
        role="meter"
        aria-label="Carbs against her limit"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={carbs}
        aria-valuetext={`${carbs} of ${limit} grams${over ? ', over the limit' : ''}`}
        className="h-2.5 overflow-hidden rounded-full bg-field"
      >
        <div className={`h-full rounded-full transition-[width] ${over ? 'bg-fail-bar' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Verdict({ verdict, compact }: { verdict: Evaluation['verdict']; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 font-bold ${TONE[verdict.status]} ${compact ? 'rounded-xl px-3 py-2.5 text-[15px]' : 'rounded-2xl px-3.5 py-3'}`}>
      <Icon name={verdict.status} size={compact ? 20 : 22} stroke={2.4} />
      <span>{verdict.text}</span>
    </div>
  );
}

/** Every check but carbs, which the meter shows. */
export function Chips({ checks }: { checks: Check[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Checks">
      {checks.filter((c) => c.kind !== 'carbs').map((c) => (
        <li key={c.kind} className={`chip ${TONE[c.status]}`}>
          <Icon name={c.status} size={16} stroke={2.8} />
          {c.text}
        </li>
      ))}
    </ul>
  );
}

// --- the plate ---------------------------------------------------------------

const names = (items: Item[], keep: (group: string) => boolean) =>
  [...new Set(items.filter((i) => keep(FOODS[i.food].group)).map((i) => shortName(FOODS[i.food])))];

/**
 * Her handout's plate: half veggies, a quarter grains, a quarter protein.
 * At breakfast the half is "empty or a small fruit", as the handout says.
 */
export function Plate({ items, type }: { items: Item[]; type: MealType }) {
  const breakfast = type === 'breakfast';
  const half = names(items, (g) => g === 'veg' || (breakfast && g === 'fruit'));
  const starch = names(items, (g) => g === 'starch' || g === 'milk' || (!breakfast && g === 'fruit'));
  const protein = names(items, (g) => g === 'protein' || g === 'fat');
  const fill = (list: string[], color: string) => (list.length ? color : 'var(--plate-empty)');
  const legend = [
    { color: 'var(--plate-veg)', label: breakfast ? 'Half: fruit or empty' : 'Half: veggies', text: half.join(', ') || (breakfast ? 'Empty is fine' : 'Add veggies') },
    { color: 'var(--plate-starch)', label: 'Quarter: grains', text: starch.join(', ') || 'None' },
    { color: 'var(--plate-protein)', label: 'Quarter: protein', text: protein.join(', ') || 'None' },
  ];
  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 120 120" aria-hidden="true" className="shrink-0">
        <circle cx="60" cy="60" r="59" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="2" />
        <path d="M60 60 L60 8 A52 52 0 0 0 60 112 Z" fill={fill(half, 'var(--plate-veg)')} stroke="var(--surface)" strokeWidth="3" />
        <path d="M60 60 L60 8 A52 52 0 0 1 112 60 Z" fill={fill(starch, 'var(--plate-starch)')} stroke="var(--surface)" strokeWidth="3" />
        <path d="M60 60 L112 60 A52 52 0 0 1 60 112 Z" fill={fill(protein, 'var(--plate-protein)')} stroke="var(--surface)" strokeWidth="3" />
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {legend.map((l) => (
          <li key={l.label} className="flex items-start gap-2 text-sm leading-snug">
            <span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-[3px]" style={{ background: l.color }} />
            <span><strong>{l.label}</strong><br /><span className="text-muted">{l.text}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A snack has no plate: just the carb and what it is paired with. */
export function Pairing({ items }: { items: Item[] }) {
  const carb = names(items, (g) => g === 'starch' || g === 'fruit' || g === 'milk');
  const veg = names(items, (g) => g === 'veg');
  const withIt = names(items, (g) => g === 'protein' || g === 'fat');
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 rounded-2xl bg-[#FBF3E2] p-3">
        <span className="label text-[#6E4A06]">{carb.length ? 'Carb' : 'Veggies'}</span>
        <div className="font-bold">{(carb.length ? carb : veg).join(', ') || '-'}</div>
      </div>
      <span aria-hidden="true" className="self-center text-[22px] font-bold text-muted">+</span>
      <div className="flex-1 rounded-2xl bg-[#F7E9E2] p-3">
        <span className="label text-[#7A3A1E]">Paired with</span>
        <div className="font-bold">{withIt.join(', ') || '-'}</div>
      </div>
    </div>
  );
}

export function SaveButton({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save this meal'} className={`iconbtn ${saved ? 'text-accent' : 'text-ink'}`}>
      <Icon name="bookmark" size={22} stroke={2} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
