'use client';

/**
 * Recipes: a photo grid of every meal, favourites marked. "For you" puts the
 * ones she is likely to want first. Opened from an empty slot on the week
 * (?type=&date=), it shows that slot's meals and puts the chosen one there.
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useData } from '@/components/DataProvider';
import RecipeCard from '@/components/RecipeCard';
import { Icon } from '@/components/ui';
import { dayName, isDayKey } from '@/lib/dates';
import { useMode } from '@/lib/mode';
import { ranked } from '@/lib/rank';
import { isMealType, MEAL_TYPES, mealTypeLabel, type MealType } from '@/lib/rules';

type Filter = 'all' | MealType | 'favourites' | 'hidden';

export default function RecipesPage() {
  return <Suspense><Recipes /></Suspense>;
}

function Recipes() {
  const params = useSearchParams();
  const { state, meals, taste, likes, today, ruledOutMeals } = useData();
  const admin = useMode() === 'admin';
  const askedType = params.get('type');
  const date = params.get('date');
  const picking = isMealType(askedType) && isDayKey(date) ? { slot: askedType, date } : null;
  const [filter, setFilter] = useState<Filter>(isMealType(askedType) ? askedType : 'all');
  const [search, setSearch] = useState('');
  if (!state) return null;

  const q = search.trim().toLowerCase();
  const hidden = meals.filter((m) => likes.get(m.id) === -1);
  let list = filter === 'hidden' ? hidden : ranked(meals, taste);
  if (filter === 'favourites') list = list.filter((m) => likes.get(m.id) === 1);
  else if (filter !== 'all' && filter !== 'hidden') list = list.filter((m) => m.type === filter);
  if (q) list = list.filter((m) => m.name.toLowerCase().includes(q) || m.items.some((i) => i.food.includes(q) || (i.label ?? '').toLowerCase().includes(q)));

  const forYou = !picking && filter === 'all' && !q ? ranked(meals, taste).slice(0, 4) : [];
  const href = (id: string) => (picking ? `/meal/${id}?date=${picking.date}&slot=${picking.slot}&pick=1` : `/meal/${id}`);
  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    ...MEAL_TYPES,
    { id: 'favourites', label: '♥ Favourites' },
    ...(hidden.length ? [{ id: 'hidden' as const, label: 'Not for me' }] : []),
  ];

  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight">Recipes</h1>
      {picking && (
        <p className="rounded-2xl bg-accent-soft px-4 py-3 font-bold text-accent-ink">
          Choosing {mealTypeLabel(picking.slot).toLowerCase()} for {dayName(picking.date, today).toLowerCase() === 'today' ? 'today' : dayName(picking.date, today)}
        </p>
      )}

      <label className="relative flex items-center">
        <span className="sr-only">Search recipes</span>
        <Icon name="search" size={20} className="pointer-events-none absolute left-3.5 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search, like “salmon” or “oats”"
          className="min-h-12 w-full rounded-2xl border-[1.5px] border-line-strong bg-surface pl-11 pr-3.5 outline-none focus:border-accent"
        />
      </label>

      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Show">
        {chips.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => setFilter(c.id)}
              aria-pressed={filter === c.id}
              className={`min-h-11 whitespace-nowrap rounded-full border-[1.5px] px-4 text-[15px] font-bold ${filter === c.id ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink'}`}
            >
              {c.label}
            </button>
          </li>
        ))}
      </ul>

      {forYou.length > 0 && (
        <section aria-labelledby="foryou" className="flex flex-col gap-3">
          <h2 id="foryou" className="label">For you</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
            {forYou.map((m) => <li key={m.id}><RecipeCard meal={m} href={href(m.id)} note={mealTypeLabel(m.type)} /></li>)}
          </ul>
          <h2 className="label mt-3">All recipes</h2>
        </section>
      )}

      <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
        {list.map((m) => <li key={m.id}><RecipeCard meal={m} href={href(m.id)} /></li>)}
      </ul>
      {filter === 'all' && !q && ruledOutMeals.length > 0 && (
        <p className="text-center text-sm text-muted">
          {ruledOutMeals.length} {ruledOutMeals.length === 1 ? 'recipe isn’t' : 'recipes aren’t'} shown because {ruledOutMeals.length === 1 ? 'it has' : 'they have'} {[...new Set(ruledOutMeals.map((r) => r.reason.replace(/^has /, '')))].join(' or ')}.
        </p>
      )}
      {!list.length && <p className="py-6 text-center text-muted">{filter === 'favourites' ? 'No favourites yet. Tap ♥ on a recipe, or 👍 after eating one.' : 'No recipes match that.'}</p>}

      {admin && (
        <Link href="/build" className="btn btn-secondary"><Icon name="plus" size={20} />Build a plate</Link>
      )}
    </>
  );
}
