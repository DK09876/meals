/**
 * PATCH { changes: { carbMeal: 30 }, base: "<rulesUpdatedAt the change was made from>" }
 *
 * Changes her limits. If someone else changed them since this copy was
 * loaded, the change is refused with 409 and the current limits, so the
 * phone can show what is really set rather than overwrite it.
 */

import { NextResponse } from 'next/server';

import { patchRules } from '@/lib/db';
import { bad, readJson, requireProfile } from '@/lib/profile-route';
import { cleanRuleChanges } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ changes?: unknown; base?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  const changes = cleanRuleChanges(body.changes);
  if (!changes) return bad('That limit is out of range');
  if (typeof body.base !== 'string') return bad('Missing base version');
  const result = patchRules(who.profile, changes, body.base);
  const payload = { rules: result.record.rules, rulesUpdatedAt: result.record.updatedAt };
  return result.ok
    ? NextResponse.json(payload)
    : NextResponse.json({ error: 'Her plan was changed on another phone', ...payload }, { status: 409 });
}
