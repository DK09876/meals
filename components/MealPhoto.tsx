'use client';

/** A recipe's photo, or - until one is chosen - a drawing of her plate in the meal's colours. */

/* eslint-disable @next/next/no-img-element -- photos are served by our own API, already sized */

import { useData } from './DataProvider';
import type { Meal } from '@/lib/catalog';

const TINT: Record<string, string> = { breakfast: '#f6ead2', lunch: '#e3efe4', dinner: '#f3e2d9', snack: '#ede6f2' };

export default function MealPhoto({ meal, className = '', rounded = 'rounded-2xl' }: { meal: Meal; className?: string; rounded?: string }) {
  const { photo } = useData();
  const src = photo(meal.id);
  if (src) return <img src={src} alt="" loading="lazy" className={`${rounded} bg-field object-cover ${className}`} />;
  return (
    <div aria-hidden="true" className={`${rounded} flex items-center justify-center ${className}`} style={{ background: TINT[meal.type] }}>
      <svg viewBox="0 0 120 120" className="h-1/2 max-h-24 w-1/2 max-w-24 opacity-80">
        <circle cx="60" cy="60" r="56" fill="#fff" />
        <path d="M60 60 L60 12 A48 48 0 0 0 60 108 Z" fill="var(--plate-veg)" />
        <path d="M60 60 L60 12 A48 48 0 0 1 108 60 Z" fill="var(--plate-starch)" />
        <path d="M60 60 L108 60 A48 48 0 0 1 60 108 Z" fill="var(--plate-protein)" />
      </svg>
    </div>
  );
}
