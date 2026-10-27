/** Small formatting helpers shared by the screens and the server. */

import { FOODS } from './foods';
import type { Item } from './rules';

/** 1.5 → "1½", 0.25 → "¼", 2 → "2". Servings move in halves; recipes use quarters and thirds. */
export function fraction(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  const part = rest < 0.1 ? '' : rest < 0.3 ? '¼' : rest < 0.42 ? '⅓' : rest < 0.6 ? '½' : rest < 0.7 ? '⅔' : rest < 0.9 ? '¾' : '';
  const w = rest >= 0.9 ? whole + 1 : whole;
  return (w ? String(w) : '') + part || '0';
}

/** What to put on the plate: a recipe's own words, or "Oatmeal · 1½ × ½ cup cooked" for a built meal. */
export function itemLabel(item: Item): string {
  if (item.label) return item.label;
  const food = FOODS[item.food];
  return item.servings === 1 ? `${food.name} · ${food.serving}` : `${food.name} · ${fraction(item.servings)} × ${food.serving}`;
}
