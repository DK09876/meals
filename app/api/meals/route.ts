/**
 * POST { type, items: [{ food, servings }], name? } - save a meal built on the Build screen.
 *
 * Checked here as well as on the phone: a meal that breaks one of her limits
 * on its own (carbs, pairing, sodium) is refused. One that is only over
 * today's cholesterol or this week's egg yolks is fine to keep - it will be
 * suggested again once it fits.
 */

import { NextResponse } from 'next/server';

import { addCustomMeal, customMealCount, getRules } from '@/lib/db';
import { isFood } from '@/lib/foods';
import { bad, readJson, requireProfile } from '@/lib/profile-route';
import { evaluate, isMealType, mealTypeLabel, type Item } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ITEMS = 20;
const MAX_SERVINGS = 10;

function cleanItems(input: unknown): Item[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ITEMS) return null;
  const items: Item[] = [];
  for (const raw of input) {
    const { food, servings } = (raw ?? {}) as { food?: unknown; servings?: unknown };
    if (!isFood(food) || typeof servings !== 'number' || servings <= 0 || servings > MAX_SERVINGS || servings * 2 !== Math.round(servings * 2)) return null;
    items.push({ food, servings });
  }
  return items;
}

export async function POST(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ type?: unknown; items?: unknown; name?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (!isMealType(body.type)) return bad('Pick breakfast, lunch, dinner or snack');
  const items = cleanItems(body.items);
  if (!items) return bad('Those foods or amounts are not right');
  const evaluation = evaluate(items, body.type, getRules(who.profile).rules);
  if (!evaluation.fitsAnyDay) return bad(evaluation.verdict.text);
  const given = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
  const name = given || `My ${mealTypeLabel(body.type).toLowerCase()} plate ${customMealCount(who.profile) + 1}`;
  return NextResponse.json({ meal: addCustomMeal(who.profile, body.type, name, items) });
}
