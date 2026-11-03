/**
 * POST  { kind, text?, path?, mode? }   - anyone: say what works or what does not (testing phase).
 * GET                                   - admin: what people said, newest first.
 * PATCH { id, done }                    - admin: mark one dealt with, or not.
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin';
import { addFeedback, FEEDBACK_KINDS, feedbackToday, listFeedback, setFeedbackDone, type FeedbackKind } from '@/lib/db';
import { bad, readJson, requireProfile } from '@/lib/profile-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_DAY = 50;

/** "iPhone, Safari" rather than the whole user-agent string. */
function device(ua: string): string {
  const what = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
  const browser = /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : '';
  return [what, browser].filter(Boolean).join(', ');
}

export async function POST(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ kind?: unknown; text?: unknown; path?: unknown; mode?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (!FEEDBACK_KINDS.includes(body.kind as FeedbackKind)) return bad('Pick how it went');
  if (feedbackToday(who.profile) >= MAX_PER_DAY) return bad('Thank you - that is plenty for today.', 429);
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const saved = addFeedback({
    profileId: who.profile,
    kind: body.kind as FeedbackKind,
    text: str(body.text, 2000),
    path: str(body.path, 200),
    mode: body.mode === 'admin' ? 'admin' : 'grandma',
    device: device(request.headers.get('user-agent') ?? ''),
    build: process.env.NEXT_PUBLIC_MEALS_BUILD ?? '',
  });
  return NextResponse.json({ id: saved.id });
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ feedback: listFeedback() });
}

export async function PATCH(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await readJson<{ id?: unknown; done?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  if (typeof body.id !== 'string' || typeof body.done !== 'boolean') return bad('id and done are required');
  return setFeedbackDone(body.id, body.done) ? NextResponse.json({ ok: true }) : bad('No such feedback', 404);
}
