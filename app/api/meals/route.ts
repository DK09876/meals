/**
 * POST { type, items: [{ food, servings, label? }], name?, steps?, minutes?, note?, source? }
 * - save a meal built on the Build screen, a fixed copy of a recipe, or one found in chat.
 *
 * Checked here as well as on the phone: a meal that breaks one of her limits
 * on its own (carbs, pairing, sodium) is refused. One that is only over
 * today's cholesterol or this week's egg yolks is fine to keep - it will be
 * suggested again once it fits.
 */

import { NextResponse } from 'next/server';

import { addCustomMeal, customMealCount, getRules } from '@/lib/db';
import { isFood } from '@/lib/foods';
import { avoidedIn } from '@/lib/restrictions';
import { fetchCommonsImage, findPhoto, storePhoto } from '@/lib/photos';
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
    const { food, servings, label } = (raw ?? {}) as { food?: unknown; servings?: unknown; label?: unknown };
    // Halves from the Build screen; recipes also use quarters and thirds.
    if (!isFood(food) || typeof servings !== 'number' || servings <= 0 || servings > MAX_SERVINGS || Math.abs(servings * 12 - Math.round(servings * 12)) > 0.05) return null;
    items.push(typeof label === 'string' && label.trim() ? { food, servings, label: label.trim().slice(0, 80) } : { food, servings });
  }
  return items;
}

export async function POST(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ type?: unknown; items?: unknown; name?: unknown; steps?: unknown; minutes?: unknown; note?: unknown; source?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (!isMealType(body.type)) return bad('Pick breakfast, lunch, dinner or snack');
  const items = cleanItems(body.items);
  if (!items) return bad('Those foods or amounts are not right');
  const { rules, restrictions } = getRules(who.profile);
  const avoided = avoidedIn(items, restrictions);
  if (avoided) return bad(`That has ${avoided.toLowerCase()}, which she doesn't eat`);
  const evaluation = evaluate(items, body.type, rules);
  if (!evaluation.fitsAnyDay) return bad(evaluation.verdict.text);
  const given = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
  const name = given || `My ${mealTypeLabel(body.type).toLowerCase()} plate ${customMealCount(who.profile) + 1}`;
  const steps = Array.isArray(body.steps) ? body.steps.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 300)).slice(0, 15) : [];
  const minutes = typeof body.minutes === 'number' && body.minutes > 0 && body.minutes < 600 ? Math.round(body.minutes) : null;
  const note = typeof body.note === 'string' ? body.note.slice(0, 300) : undefined;
  const source = body.source === 'chat' || body.source === 'fixed' ? body.source : 'built';
  const meal = addCustomMeal(who.profile, body.type, name, items, { steps, minutes, note, source });
  // A recipe from chat gets its photo in the background; the page shows the plate drawing until then.
  if (source === 'chat') void findPhoto(meal.name).then((c) => c && fetchCommonsImage(c.thumb).then((bytes) => storePhoto(meal.id, bytes, c))).catch(() => {});
  return NextResponse.json({ meal });
}
