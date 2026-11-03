/**
 * POST - admin: give every recipe that has no photo the top Commons match
 * for its name. One search at a time, politely; any it cannot find are
 * listed so someone can pick or upload one.
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin';
import { CATALOG } from '@/lib/catalog';
import { getPhoto, listCustomMeals } from '@/lib/db';
import { fetchCommonsImage, findPhoto, storePhoto } from '@/lib/photos';
import { requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const missing: string[] = [];
  let added = 0;
  for (const meal of [...CATALOG, ...listCustomMeals(who.profile)]) {
    if (getPhoto(meal.id)) continue;
    try {
      const first = await findPhoto(meal.name, meal.photo);
      if (!first) { missing.push(meal.name); continue; }
      storePhoto(meal.id, await fetchCommonsImage(first.thumb), { credit: first.credit, license: first.license, page: first.page });
      added++;
    } catch (e) {
      console.error(`photo for ${meal.id}:`, e instanceof Error ? e.message : e);
      missing.push(meal.name);
    }
  }
  return NextResponse.json({ added, missing });
}
