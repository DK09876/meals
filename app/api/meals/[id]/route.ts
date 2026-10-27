/** DELETE - remove a built meal. What she already ate from it stays in her history. */

import { NextResponse } from 'next/server';

import { deleteCustomMeal } from '@/lib/db';
import { bad, requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const { id } = await params;
  if (!deleteCustomMeal(who.profile, id)) return bad('No such meal', 404);
  return NextResponse.json({ ok: true });
}
