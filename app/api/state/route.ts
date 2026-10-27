/**
 * GET everything the screens need for one profile, in one go: her limits
 * (with their version, for the stale check), saved meals, the at-home list,
 * built meals and the last month of what she ate.
 *
 * The x-meals-build header tells an open page which build the server is on;
 * a page from an older build reloads itself.
 */

import { NextResponse } from 'next/server';

import { getRules, listCustomMeals, listLog, listPantry, listProfiles, listSaved } from '@/lib/db';
import { requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const { rules, updatedAt } = getRules(who.profile);
  return NextResponse.json(
    {
      profile: listProfiles().find((p) => p.id === who.profile),
      rules,
      rulesUpdatedAt: updatedAt,
      saved: listSaved(who.profile),
      pantry: listPantry(who.profile),
      custom: listCustomMeals(who.profile),
      log: listLog(who.profile),
    },
    { headers: { 'x-meals-build': process.env.NEXT_PUBLIC_MEALS_BUILD ?? '', 'cache-control': 'no-store' } },
  );
}
