/**
 * POST { messages: [{ role, content }], grandma? } - recipe ideas that fit her plan.
 *
 * Free models (lib/chat.ts), checked here before anything reaches the phone.
 * A ceiling of 150 questions a day keeps a stuck phone from using up the
 * free quota that MTG Tracker shares.
 */

import { NextResponse } from 'next/server';

import { CATALOG } from '@/lib/catalog';
import { ask, ChatUnavailable, configuredModels, type ChatMessage } from '@/lib/chat';
import { dayKey } from '@/lib/dates';
import { getRules, getSetting, listCustomMeals, listLikes, listPantry, setSetting } from '@/lib/db';
import { FOODS } from '@/lib/foods';
import { bad, readJson, requireProfile } from '@/lib/profile-route';
import { upstreamUrl } from '@/lib/upstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAILY_LIMIT = 150;

function cleanMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || !input.length || input.length > 20) return null;
  const out: ChatMessage[] = [];
  for (const m of input as Array<{ role?: unknown; content?: unknown }>) {
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) return null;
    out.push({ role: m.role, content: m.content.trim().slice(0, 1200) });
  }
  return out[out.length - 1].role === 'user' ? out : null;
}

export async function POST(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  const body = await readJson<{ messages?: unknown; grandma?: unknown }>(request);
  if (body instanceof NextResponse) return body;
  const messages = cleanMessages(body.messages);
  if (!messages) return bad('Say what you would like');

  // No model keys here, but a Pi to ask: pass the question on (lib/upstream.ts).
  const upstream = configuredModels().length ? null : upstreamUrl('chat');
  if (upstream) {
    try {
      const res = await fetch(upstream, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, grandma: body.grandma !== false }), signal: AbortSignal.timeout(60_000) });
      return NextResponse.json(await res.json(), { status: res.status });
    } catch {
      return bad('Could not reach the Pi for recipe ideas. Is Tailscale on?', 503);
    }
  }

  const key = `chat.count.${dayKey(new Date())}`;
  const used = Number(getSetting(key) ?? 0);
  if (used >= DAILY_LIMIT) return bad('That is enough questions for today. The recipe helper is back tomorrow.', 429);
  setSetting(key, String(used + 1));

  const likes = listLikes(who.profile);
  const name = (id: string) => [...CATALOG, ...listCustomMeals(who.profile)].find((m) => m.id === id)?.name;
  const named = (v: 1 | -1) => Object.entries(likes).filter(([, x]) => x === v).map(([id]) => name(id)).filter((n): n is string => !!n).slice(0, 15);
  try {
    const answer = await ask(messages, {
      rules: getRules(who.profile).rules,
      pantry: listPantry(who.profile).map((id) => FOODS[id]?.name).filter((n): n is string => !!n),
      favourites: named(1),
      notForMe: named(-1),
      grandma: body.grandma !== false,
    }, configuredModels());
    return NextResponse.json(answer);
  } catch (e) {
    if (e instanceof ChatUnavailable) return bad(e.message, 503);
    throw e;
  }
}
