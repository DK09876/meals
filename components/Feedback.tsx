'use client';

/**
 * The testing phase on screen: a strip saying the app is being tested and
 * what is being tried, and a sheet where anyone - Grandma too - says how it
 * is going, by tapping one big button and, if they like, saying more (typed
 * or spoken). The screen they were on goes with it.
 */

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { useData } from './DataProvider';
import MicButton from './MicButton';
import Sheet from './Sheet';
import { useToast } from './Toast';
import { Icon } from './ui';
import * as api from '@/lib/api';
import { useMode } from '@/lib/mode';

const KINDS: Array<{ id: api.FeedbackKind; emoji: string; label: string }> = [
  { id: 'good', emoji: '👍', label: 'Works well' },
  { id: 'confusing', emoji: '😕', label: 'Confusing' },
  { id: 'wrong', emoji: '🐞', label: 'Something’s wrong' },
  { id: 'idea', emoji: '💡', label: 'An idea' },
];

export const FEEDBACK_EMOJI: Record<api.FeedbackKind, string> = { good: '👍', confusing: '😕', wrong: '🐞', idea: '💡' };
export const FEEDBACK_LABEL: Record<api.FeedbackKind, string> = { good: 'Works well', confusing: 'Confusing', wrong: 'Something’s wrong', idea: 'An idea' };

export function TestingBanner() {
  const { state } = useData();
  const [open, setOpen] = useState(false);
  if (!state?.testing.on) return null;
  return (
    <>
      <div className="safe-x">
        <button
          onClick={() => setOpen(true)}
          className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-[#c9b8e6] bg-[#f1ebfa] px-3.5 py-2 text-left text-[15px]"
          aria-label="Test version. Tell us how it's going"
        >
          <span aria-hidden="true">🧪</span>
          <span className="font-bold text-[#4a2f7a]">Test version</span>
          <span className="flex-1 truncate text-[#5b4a75]">· Tell us how it&apos;s going</span>
          <Icon name="next" size={18} className="shrink-0 text-[#5b3d91]" />
        </button>
      </div>
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const { state } = useData();
  const toast = useToast();
  const path = usePathname();
  const mode = useMode();
  const grandma = mode === 'grandma';
  const [kind, setKind] = useState<api.FeedbackKind | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title={grandma ? 'How is it going?' : 'Give feedback'} onClose={onClose}>
      <p className="-mt-2 text-[16px] text-muted">
        This is a test version. We&apos;re trying out {state?.testing.note}. Tell us what works and what doesn&apos;t. Every bit helps.
      </p>
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="How it went">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-[16px] font-bold ${kind === k.id ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface'}`}
          >
            <span aria-hidden="true" className="text-3xl">{k.emoji}</span>{k.label}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="label">Tell us more (if you like)</span>
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={grandma ? 'What happened? What would make it easier?' : 'What happened, and on which screen?'}
            className="min-h-24 min-w-0 flex-1 rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 py-3 outline-none focus:border-accent"
          />
          <MicButton onText={(said) => setText((t) => (t ? `${t} ${said}` : said))} />
        </div>
      </label>
      <button
        className="btn btn-primary"
        disabled={!kind || busy}
        onClick={async () => {
          if (!kind) return;
          setBusy(true);
          try {
            await api.sendFeedback(kind, text, path, mode);
            toast('Thank you! We read every one.');
            onClose();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not send that. Try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="next" size={20} />{busy ? 'Sending…' : 'Send'}
      </button>
      <p className="text-center text-xs text-muted">Sent with the screen you were on, so we know where to look.</p>
    </Sheet>
  );
}
