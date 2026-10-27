/**
 * The people the app cooks for, and a new one.
 *
 * Unauthenticated and name-only, like the other apps' profiles: the chooser
 * needs the list before anyone has picked. A profile is somewhere to keep one
 * person's limits and meals, not a login.
 */

import { NextResponse } from 'next/server';

import { createProfile, listProfiles } from '@/lib/db';
import { bad, readJson } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ profiles: listProfiles() });
}

const MAX_NAME = 30;
const MAX_PROFILES = 20;

export async function POST(request: Request) {
  const body = await readJson<{ name?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) return bad('Add a name');
  if (name.length > MAX_NAME) return bad(`Keep it under ${MAX_NAME} characters`);
  // A ceiling, so a script hammering the button cannot fill the table.
  if (listProfiles().length >= MAX_PROFILES) return bad('That is enough people for one Pi');
  return NextResponse.json({ profile: createProfile(name) });
}
