/** GET ?q=lentil soup - admin: freely licensed photos from Wikimedia Commons to pick from. */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin';
import { searchCommons } from '@/lib/photos';
import { bad } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, 100);
  if (!q) return bad('q is required');
  try {
    return NextResponse.json({ candidates: await searchCommons(q) });
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Photo search failed', 502);
  }
}
