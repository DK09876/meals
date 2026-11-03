/**
 * GET  - a recipe's photo (cached for good: the URL carries a version).
 * POST - admin: { thumb, credit, license, page } picks a Commons photo;
 *        a multipart form with "file" uploads your own.
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin';
import { getPhoto } from '@/lib/db';
import { fetchCommonsImage, MAX_PHOTO_BYTES, readPhoto, storePhoto } from '@/lib/photos';
import { bad } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const row = getPhoto((await params).id);
  if (!row) return bad('No photo', 404);
  try {
    return new NextResponse(new Uint8Array(readPhoto(row.file)), { headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable' } });
  } catch {
    return bad('Photo file missing', 404);
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    if ((request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      const file = (await request.formData()).get('file');
      if (!(file instanceof File)) return bad('No file');
      if (file.size > MAX_PHOTO_BYTES) return bad('That picture is too big (6 MB at most)');
      storePhoto(id, new Uint8Array(await file.arrayBuffer()), { credit: 'Family photo', license: '', page: '' });
    } else {
      const body = await request.json() as { thumb?: unknown; credit?: unknown; license?: unknown; page?: unknown };
      if (typeof body.thumb !== 'string') return bad('thumb is required');
      const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 300) : '');
      storePhoto(id, await fetchCommonsImage(body.thumb), { credit: str(body.credit), license: str(body.license), page: str(body.page) });
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Could not save that photo');
  }
  return NextResponse.json({ ok: true });
}
