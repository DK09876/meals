'use client';

/**
 * Tap, speak, tap again: the words go into the box. Recorded on the phone,
 * turned into text on the Pi (whisper.cpp) - free and private. If the phone
 * will not record, it points to the microphone on the keyboard instead.
 */

import { useEffect, useRef, useState } from 'react';

import { useToast } from './Toast';
import { Icon } from './ui';
import * as api from '@/lib/api';

// whisper on the Pi listens to at most 15 s (deploy/whisper.service).
const MAX_MS = 15_000;

export default function MicButton({ onText, big = false }: { onText: (text: string) => void; big?: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => { clearTimeout(timer.current); recorder.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('Use the microphone on the keyboard to speak.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('working');
        try {
          const text = await api.dictate(new Blob(chunks, { type: rec.mimeType || type || 'audio/mp4' }));
          if (text) onText(text);
          else toast("I didn't catch that. Try again, a little closer.");
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Voice typing is not working right now.');
        } finally {
          setState('idle');
        }
      };
      recorder.current = rec;
      rec.start();
      setState('recording');
      timer.current = setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_MS);
    } catch {
      toast('The microphone is off for this app. You can use the microphone on the keyboard instead.');
    }
  };

  const stop = () => { clearTimeout(timer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); };

  const label = state === 'recording' ? 'Stop and use what I said' : state === 'working' ? 'Working out what you said' : 'Speak instead of typing';
  return (
    <button
      type="button"
      onClick={state === 'recording' ? stop : start}
      disabled={state === 'working'}
      aria-label={label}
      aria-pressed={state === 'recording'}
      className={`flex shrink-0 items-center justify-center rounded-2xl font-bold ${big ? 'min-h-14 gap-2 px-5 text-[17px]' : 'size-12'} ${state === 'recording' ? 'animate-pulse bg-fail-bar text-white' : 'border-[1.5px] border-accent bg-accent-soft text-accent-ink'}`}
    >
      <Icon name="mic" size={big ? 26 : 22} />
      {big && (state === 'recording' ? 'Listening… tap to stop' : state === 'working' ? 'One moment…' : 'Speak')}
    </button>
  );
}
