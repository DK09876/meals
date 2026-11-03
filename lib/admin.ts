/**
 * Admin mode: the family's side of the app (her limits, groceries, photos),
 * behind a password so Grandma's view stays simple and nothing is changed
 * by a stray tap.
 *
 * The password is set the first time someone opens admin mode, and is kept
 * only as a scrypt hash. Signing in gives the phone an HttpOnly session
 * cookie for 30 days; the server checks it on every admin-only route, so
 * hiding a button is never the only thing standing in the way.
 *
 * This guards against mistakes inside the family, not strangers: the app is
 * only reachable on the tailnet.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

import { NextResponse } from 'next/server';

import { addSession, deleteSession, getSetting, sessionValid, setSetting } from './db';

export const COOKIE = 'meals_admin';
const SESSION_DAYS = 30;
const KEY = 'admin.password';

export const MIN_PASSWORD = 4;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 32).toString('base64')}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

export const passwordSet = () => getSetting(KEY) !== null;
export const setPassword = (password: string) => setSetting(KEY, hashPassword(password));
export const passwordMatches = (password: string) => {
  const stored = getSetting(KEY);
  return stored !== null && checkPassword(password, stored);
};

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function cookieToken(request: Request): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function isAdmin(request: Request): boolean {
  const token = cookieToken(request);
  return !!token && sessionValid(tokenHash(token));
}

/** The response to send instead, or null when the request is from an admin. */
export function requireAdmin(request: Request): NextResponse | null {
  return isAdmin(request) ? null : NextResponse.json({ error: 'Admin only. Unlock admin mode first.' }, { status: 403 });
}

/** Starts a session on this response. */
export function signIn(response: NextResponse): NextResponse {
  const token = randomBytes(32).toString('base64url');
  addSession(tokenHash(token), new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString());
  response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: SESSION_DAYS * 86_400 });
  return response;
}

export function signOut(request: Request, response: NextResponse): NextResponse {
  const token = cookieToken(request);
  if (token) deleteSession(tokenHash(token));
  response.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}

/** Five wrong passwords in a row lock sign-in for 30 s. In memory: a restart forgives. */
const failures = { count: 0, until: 0 };

export function lockedFor(): number {
  return Math.max(0, Math.ceil((failures.until - Date.now()) / 1000));
}

export function recordFailure(): void {
  failures.count++;
  if (failures.count >= 5) {
    failures.until = Date.now() + 30_000;
    failures.count = 0;
  }
}

export const recordSuccess = () => { failures.count = 0; failures.until = 0; };
