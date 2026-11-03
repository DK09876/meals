/**
 * PUT { store?, testing?, testingNote? } - admin settings:
 * the Instacart store the grocery links search ("costco", or "" for any),
 * and the testing phase - on or off, and what is being tested right now.
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin';
import { setSetting } from '@/lib/db';
import { isStoreSlug } from '@/lib/grocery';
import { bad, readJson } from '@/lib/profile-route';
import { setTesting, testingState } from '@/lib/testing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await readJson<{ store?: unknown; testing?: unknown; testingNote?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (body.testing !== undefined || body.testingNote !== undefined) {
    if (body.testing !== undefined && typeof body.testing !== 'boolean') return bad('testing is on or off');
    if (body.testingNote !== undefined && typeof body.testingNote !== 'string') return bad('testingNote is text');
    const testing = setTesting({ on: body.testing as boolean | undefined, note: (body.testingNote as string | undefined)?.slice(0, 300) });
    if (body.store === undefined) return NextResponse.json({ ok: true, testing });
  }
  const store = typeof body.store === 'string' ? body.store.trim().toLowerCase() : null;
  if (store === null || !isStoreSlug(store)) return bad('Use the store name from its Instacart address, like costco or safeway');
  setSetting('instacart.store', store || null);
  return NextResponse.json({ ok: true, store, testing: testingState() });
}
