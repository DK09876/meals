'use client';

/** One recipe in the photo grid: photo, name, time and carbs. */

import Link from 'next/link';

import { useData } from './DataProvider';
import MealPhoto from './MealPhoto';
import { Icon } from './ui';
import type { Meal } from '@/lib/catalog';
import { totals } from '@/lib/rules';

export default function RecipeCard({ meal, href, note }: { meal: Meal; href: string; note?: string }) {
  const { likes } = useData();
  const fav = likes.get(meal.id) === 1;
  return (
    <Link href={href} className="group flex flex-col gap-2" aria-label={`${meal.name}${fav ? ', favourite' : ''}`}>
      <div className="relative">
        <MealPhoto meal={meal} className="aspect-[4/3] w-full" />
        {fav && (
          <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-[#c0392b] shadow" aria-hidden="true">
            <Icon name="heart" size={18} stroke={2} fill="currentColor" />
          </span>
        )}
      </div>
      <span className="line-clamp-2 text-[17px] font-bold leading-snug">{meal.name}</span>
      <span className="-mt-1 text-sm text-muted">
        {meal.minutes ? `${meal.minutes} min · ` : ''}{Math.round(totals(meal.items).carbs)} g carbs
      </span>
      {note && <span className="-mt-1 text-sm font-bold text-accent">{note}</span>}
    </Link>
  );
}
