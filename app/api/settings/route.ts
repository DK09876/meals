/** PUT { store } - admin: the Instacart store the grocery links search ("costco"), or "" for any store. */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin';
import { setSetting } from '@/lib/db';
import { isStoreSlug } from '@/lib/grocery';
import { bad, readJson } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await readJson<{ store?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  const store = typeof body.store === 'string' ? body.store.trim().toLowerCase() : null;
  if (store === null || !isStoreSlug(store)) return bad('Use the store name from its Instacart address, like costco or safeway');
  setSetting('instacart.store', store || null);
  return NextResponse.json({ ok: true, store });
}
