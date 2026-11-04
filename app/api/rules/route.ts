/**
 * PATCH { changes?: { carbMeal: 30 }, restrictions?: { avoid, noCaffeine }, base: "<rulesUpdatedAt>" }
 *
 * Changes her limits. If someone else changed them since this copy was
 * loaded, the change is refused with 409 and the current limits, so the
 * phone can show what is really set rather than overwrite it.
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin';
import { patchRules } from '@/lib/db';
import { bad, readJson, requireProfile } from '@/lib/profile-route';
import { cleanRestrictions } from '@/lib/restrictions';
import { cleanRuleChanges } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ changes?: unknown; restrictions?: unknown; base?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  // No limits changed (only Never use) comes as {} from the phone.
  const noChanges = body.changes === undefined || (typeof body.changes === 'object' && body.changes !== null && !Object.keys(body.changes).length);
  const changes = noChanges ? {} : cleanRuleChanges(body.changes);
  if (!changes) return bad('That limit is out of range');
  const restrictions = body.restrictions === undefined ? undefined : cleanRestrictions(body.restrictions);
  if (restrictions === null) return bad('Unknown food to avoid');
  if (!Object.keys(changes).length && !restrictions) return bad('Nothing to change');
  if (typeof body.base !== 'string') return bad('Missing base version');
  const result = patchRules(who.profile, changes, body.base, restrictions);
  const payload = { rules: result.record.rules, restrictions: result.record.restrictions, rulesUpdatedAt: result.record.updatedAt };
  return result.ok
    ? NextResponse.json(payload)
    : NextResponse.json({ error: 'Her plan was changed on another phone', ...payload }, { status: 409 });
}
