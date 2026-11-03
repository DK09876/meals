/** PUT { mealId, value: 1 | 0 | -1 } - a favourite, no opinion, or "not for me". */

import { NextResponse } from 'next/server';

import { findMeal, setLike } from '@/lib/db';
import { bad, readJson, requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ mealId?: unknown; value?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (typeof body.mealId !== 'string' || (body.value !== 1 && body.value !== 0 && body.value !== -1)) return bad('mealId and value are required');
  if (body.value !== 0 && !findMeal(who.profile, body.mealId)) return bad('No such meal', 404);
  setLike(who.profile, body.mealId, body.value);
  return NextResponse.json({ ok: true });
}
