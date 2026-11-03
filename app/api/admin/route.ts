/**
 * GET                                   - { configured, admin }: is there a password, and is this phone signed in
 * POST { action: 'setup', password }    - the first password, only while none is set; signs in
 * POST { action: 'login', password }    - sign in this phone
 * POST { action: 'logout' }             - sign out this phone
 * POST { action: 'change', current, next } - new password (signs every phone out, then this one in)
 */

import { NextResponse } from 'next/server';

import { isAdmin, lockedFor, MIN_PASSWORD, passwordMatches, passwordSet, recordFailure, recordSuccess, setPassword, signIn, signOut } from '@/lib/admin';
import { deleteAllSessions } from '@/lib/db';
import { bad, readJson } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return NextResponse.json({ configured: passwordSet(), admin: isAdmin(request) });
}

const validNew = (p: unknown): p is string => typeof p === 'string' && p.length >= MIN_PASSWORD && p.length <= 200;

export async function POST(request: Request) {
  const body = await readJson<{ action?: unknown; password?: unknown; current?: unknown; next?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  switch (body.action) {
    case 'setup':
      if (passwordSet()) return bad('A password is already set', 409);
      if (!validNew(body.password)) return bad(`Use at least ${MIN_PASSWORD} characters`);
      setPassword(body.password);
      return signIn(NextResponse.json({ ok: true }));
    case 'login': {
      const wait = lockedFor();
      if (wait) return bad(`Too many tries. Wait ${wait} seconds.`, 429);
      if (typeof body.password !== 'string' || !passwordMatches(body.password)) {
        recordFailure();
        return bad('That password is not right', 401);
      }
      recordSuccess();
      return signIn(NextResponse.json({ ok: true }));
    }
    case 'logout':
      return signOut(request, NextResponse.json({ ok: true }));
    case 'change':
      if (!isAdmin(request)) return bad('Admin only', 403);
      if (typeof body.current !== 'string' || !passwordMatches(body.current)) return bad('The current password is not right', 401);
      if (!validNew(body.next)) return bad(`Use at least ${MIN_PASSWORD} characters`);
      setPassword(body.next);
      deleteAllSessions();
      return signIn(NextResponse.json({ ok: true }));
    default:
      return bad('Unknown action');
  }
}
