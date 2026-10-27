/**
 * Which profile a request is for, checked against the database.
 *
 * Every data route takes `?profile=`, as the other apps on the Pi do. A
 * missing or unknown profile is refused rather than defaulted, so nothing is
 * ever written where its owner cannot see it.
 */

import { NextResponse } from 'next/server';

import { knownProfile } from './db';

export function profileOf(request: Request): string | null {
  return knownProfile(new URL(request.url).searchParams.get('profile')?.trim() || null);
}

/** The profile, or the response to send instead. */
export function requireProfile(request: Request): { profile: string } | NextResponse {
  const profile = profileOf(request);
  return profile ? { profile } : NextResponse.json({ error: 'Pick who you are cooking for first' }, { status: 400 });
}

export async function readJson<T>(request: Request): Promise<T | NextResponse> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as T) : NextResponse.json({ error: 'invalid json' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
