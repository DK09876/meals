/** PUT { mealId, on } - bookmark a meal or take the bookmark off. Saying the same thing twice is fine. */

import { NextResponse } from 'next/server';

import { findMeal, setSaved } from '@/lib/db';
import { bad, readJson, requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ mealId?: unknown; on?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (typeof body.mealId !== 'string' || typeof body.on !== 'boolean') return bad('mealId and on are required');
  // Unsaving a meal that has since been deleted is still allowed.
  if (body.on && !findMeal(who.profile, body.mealId)) return bad('No such meal', 404);
  setSaved(who.profile, body.mealId, body.on);
  return NextResponse.json({ ok: true });
}
