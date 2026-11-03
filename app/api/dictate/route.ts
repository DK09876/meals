/**
 * POST audio (multipart "audio", up to 15 s) - the words in it, as text.
 *
 * Speech to text runs on the Pi itself, with whisper.cpp's server
 * (deploy/whisper.service, 127.0.0.1:8792): free, and her voice never leaves
 * the house. The phone records with MediaRecorder; whisper-server converts
 * the iPhone's AAC with ffmpeg.
 */

import { NextResponse } from 'next/server';

import { bad, requireProfile } from '@/lib/profile-route';
import { upstreamUrl } from '@/lib/upstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 3 * 1024 * 1024;
const WHISPER_URL = () => process.env.MEALS_WHISPER_URL || 'http://127.0.0.1:8792/inference';

export async function POST(request: Request) {
  const who = requireProfile(request);
  if (who instanceof NextResponse) return who;
  let audio: FormDataEntryValue | null;
  try {
    audio = (await request.formData()).get('audio');
  } catch {
    return bad('No recording');
  }
  if (!(audio instanceof File) || !audio.size) return bad('No recording');
  if (audio.size > MAX_BYTES) return bad('That recording is too long');

  // A copy running elsewhere passes the recording on to the Pi (lib/upstream.ts).
  const upstream = upstreamUrl('dictate');
  if (upstream) {
    const form = new FormData();
    form.append('audio', audio, audio.name || 'speech.m4a');
    try {
      const res = await fetch(upstream, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
      return NextResponse.json(await res.json(), { status: res.status });
    } catch {
      return bad('Could not reach the Pi for voice typing. Is Tailscale on?', 503);
    }
  }

  const form = new FormData();
  form.append('file', audio, audio.name || 'speech.m4a');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  try {
    const res = await fetch(WHISPER_URL(), { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`whisper ${res.status}`);
    const body = await res.json() as { text?: string };
    const text = (body.text ?? '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    return NextResponse.json({ text });
  } catch (e) {
    console.error('dictate:', e instanceof Error ? e.message : e);
    return bad('Voice typing is not working right now. Use the microphone on the keyboard instead.', 503);
  }
}
