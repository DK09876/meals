/**
 * GET everything the screens need for one profile, in one go: her limits
 * (with their version, for the stale check), favourites, her week plan,
 * the at-home list, built meals, photos, the last month of what she ate,
 * and whether this phone is in admin mode.
 *
 * The x-meals-build header tells an open page which build the server is on;
 * a page from an older build reloads itself.
 */

import { NextResponse } from 'next/server';

import { isAdmin, passwordSet } from '@/lib/admin';
import { addDays, dayKey } from '@/lib/dates';
import { getRules, getSetting, listCustomMeals, listLikes, listLog, listPantry, listPhotos, listPlan, listProfiles } from '@/lib/db';
import { ensurePhotos } from '@/lib/auto-photos';
import { requireProfile } from '@/lib/profile-route';
import { testingState } from '@/lib/testing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  ensurePhotos();
  const { rules, restrictions, updatedAt } = getRules(who.profile);
  return NextResponse.json(
    {
      profile: listProfiles().find((p) => p.id === who.profile),
      rules,
      restrictions,
      rulesUpdatedAt: updatedAt,
      likes: listLikes(who.profile),
      plan: listPlan(who.profile, addDays(dayKey(new Date()), -14)),
      photos: listPhotos(),
      admin: isAdmin(request),
      adminConfigured: passwordSet(),
      store: getSetting('instacart.store') ?? '',
      testing: testingState(),
      pantry: listPantry(who.profile),
      custom: listCustomMeals(who.profile),
      log: listLog(who.profile),
    },
    { headers: { 'x-meals-build': process.env.NEXT_PUBLIC_MEALS_BUILD ?? '', 'cache-control': 'no-store' } },
  );
}
