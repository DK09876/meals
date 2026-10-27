/** PUT { foodId, on } - tick a food on or off the at-home list. */

import { NextResponse } from 'next/server';

import { setPantry } from '@/lib/db';
import { isFood } from '@/lib/foods';
import { bad, readJson, requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ foodId?: unknown; on?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (!isFood(body.foodId) || typeof body.on !== 'boolean') return bad('foodId and on are required');
  setPantry(who.profile, body.foodId, body.on);
  return NextResponse.json({ ok: true });
}
