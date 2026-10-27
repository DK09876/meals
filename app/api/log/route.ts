/**
 * POST { mealId } - she ate this, now. The entry keeps a copy of the meal.
 * DELETE ?id=      - take an entry back (the Undo on the toast).
 */

import { NextResponse } from 'next/server';

import { deleteLogEntry, findMeal, logMeal } from '@/lib/db';
import { bad, readJson, requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ mealId?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  const meal = typeof body.mealId === 'string' ? findMeal(who.profile, body.mealId) : undefined;
  if (!meal) return bad('No such meal', 404);
  return NextResponse.json({ entry: logMeal(who.profile, meal) });
}

export async function DELETE(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !deleteLogEntry(who.profile, id)) return bad('No such entry', 404);
  return NextResponse.json({ ok: true });
}
