/**
 * PUT  { date, slot, mealId | null, force? } - put a meal in a slot, or empty it.
 *      A meal that would break her limits for that day or week is refused
 *      (422) with what to pick instead; an admin can add it anyway with force.
 * POST { action: 'fill', start }             - fill the empty slots of seven days from start.
 */

import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/admin';
import { isDayKey } from '@/lib/dates';
import { addPlanEntries, findMeal, setPlanSlot } from '@/lib/db';
import { alternatives, checkSlot, fillWeek } from '@/lib/plan';
import { bad, readJson, requireProfile } from '@/lib/profile-route';
import { isMealType } from '@/lib/rules';
import { loadWorld } from '@/lib/world';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ date?: unknown; slot?: unknown; mealId?: unknown; force?: unknown; weekStart?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (!isDayKey(body.date) || !isMealType(body.slot)) return bad('date and slot are required');
  if (body.mealId === null) {
    setPlanSlot(who.profile, body.date, body.slot, null);
    return NextResponse.json({ ok: true });
  }
  const meal = typeof body.mealId === 'string' ? findMeal(who.profile, body.mealId) : undefined;
  if (!meal) return bad('No such meal', 404);
  if (meal.type !== body.slot) return bad(`That is a ${meal.type} recipe`);
  const { world, meals, taste } = loadWorld(who.profile);
  const evaluation = checkSlot(world, body.date, body.slot, meal);
  if (!evaluation.fits && !(body.force === true && isAdmin(request))) {
    const weekStart = isDayKey(body.weekStart) ? body.weekStart : body.date;
    const alt = alternatives(world, meals, taste, body.date, body.slot, meal, weekStart);
    return NextResponse.json({ error: evaluation.verdict.text, verdict: evaluation.verdict, instead: alt.instead.map((m) => m.id), otherDays: alt.otherDays }, { status: 422 });
  }
  setPlanSlot(who.profile, body.date, body.slot, meal.id);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ action?: unknown; start?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (body.action !== 'fill' || !isDayKey(body.start)) return bad('action fill and start are required');
  const { world, meals, taste } = loadWorld(who.profile);
  const entries = fillWeek(world, meals, taste, body.start);
  return NextResponse.json({ added: addPlanEntries(who.profile, entries) });
}
