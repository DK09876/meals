'use client';

/** Admin settings: her limits, recipe photos, the admin password, and locking admin mode on this phone. */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import AdminGate from '@/components/AdminGate';
import { useData } from '@/components/DataProvider';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/ui';
import * as api from '@/lib/api';
import { setMode } from '@/lib/mode';
import Limits from './limits';
import { FEEDBACK_EMOJI, FEEDBACK_LABEL } from '@/components/Feedback';
import { timeLabel, dayLabel } from '@/lib/history';

export default function SettingsPage() {
  return (
    <AdminGate>
      <h1 className="text-[30px] font-bold leading-tight">Settings</h1>
      <Testing />
      <Limits />
      <Photos />
      <Links />
      <Password />
    </AdminGate>
  );
}

function Photos() {
  const { meals, state, refresh } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const without = meals.filter((m) => !state.photos[m.id]).length;
  return (
    <section className="card flex flex-col gap-3" aria-labelledby="photos">
      <h2 id="photos" className="text-lg font-bold">Recipe photos</h2>
      <p className="text-muted">{without ? `${without} of ${meals.length} recipes have no photo yet.` : 'Every recipe has a photo.'} Photos come from Wikimedia Commons (free to use, with credit) or your own. Change one from its recipe page.</p>
      {without > 0 && (
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api.autoPhotos();
              toast(`Added ${r.added} ${r.added === 1 ? 'photo' : 'photos'}.${r.missing.length ? ` None found for: ${r.missing.join(', ')}.` : ''}`);
              await refresh();
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Could not find photos');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="camera" size={20} />{busy ? 'Finding photos…' : 'Find photos for the rest'}
        </button>
      )}
    </section>
  );
}

function Links() {
  return (
    <section className="card flex flex-col p-0" aria-label="More">
      {[
        { href: '/history', label: 'What she ate' },
        { href: '/build', label: 'Build a plate' },
      ].map((l, n) => (
        <Link key={l.href} href={l.href} className={`flex min-h-14 items-center justify-between px-4.5 font-bold ${n ? 'border-t border-line-soft' : ''}`}>
          {l.label}<Icon name="next" size={20} className="text-muted" />
        </Link>
      ))}
    </section>
  );
}

function Password() {
  const { refresh } = useData();
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <section className="card flex flex-col gap-3" aria-labelledby="pw">
      <h2 id="pw" className="text-lg font-bold">Admin password</h2>
      {open ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.adminAction({ action: 'change', current, next });
              toast('Password changed. Other phones will need it again.');
              setOpen(false); setCurrent(''); setNext('');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not change it');
            }
          }}
        >
          <input type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} className="min-h-12 rounded-2xl border-[1.5px] border-line-strong px-3.5" />
          <input type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" value={next} onChange={(e) => setNext(e.target.value)} className="min-h-12 rounded-2xl border-[1.5px] border-line-strong px-3.5" />
          <button className="btn btn-primary" disabled={!current || next.length < 4}>Change password</button>
        </form>
      ) : (
        <button className="btn btn-secondary" onClick={() => setOpen(true)}>Change password</button>
      )}
      <button
        className="btn btn-secondary"
        onClick={async () => { await api.adminAction({ action: 'logout' }); setMode('grandma'); await refresh(); router.push('/'); }}
      >
        <Icon name="lock" size={20} />Lock admin on this phone
      </button>
    </section>
  );
}

/** The testing phase: on or off, what is being tested, and what people said. */
function Testing() {
  const { state, refresh, now } = useData();
  const toast = useToast();
  const [note, setNote] = useState<string | null>(null);
  const [items, setItems] = useState<api.FeedbackItem[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const load = useCallback(async () => { try { setItems(await api.listFeedback()); } catch { setItems([]); } }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load once when the section opens
  useEffect(() => { void load(); }, [load]);
  if (!state) return null;
  const open = (items ?? []).filter((f) => !f.doneAt);
  const done = (items ?? []).filter((f) => f.doneAt);
  const save = async (change: { testing?: boolean; testingNote?: string }) => {
    try { await api.setTesting(change); await refresh(); } catch (e) { toast(e instanceof Error ? e.message : 'Could not save'); }
  };

  const row = (f: api.FeedbackItem) => (
    <li key={f.id} className="flex flex-col gap-1.5 border-t border-line-soft py-3">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-xl">{FEEDBACK_EMOJI[f.kind]}</span>
        <span className="flex flex-1 flex-col">
          <span className="font-bold">{FEEDBACK_LABEL[f.kind]}</span>
          {f.text && <span className="text-[16px]">{f.text}</span>}
          <span className="text-sm text-muted">{f.profileId} · {f.mode === 'grandma' ? 'Grandma’s view' : 'admin'} · {f.path || '/'} · {f.device} · {dayLabel(f.createdAt, now)} {timeLabel(f.createdAt)}</span>
        </span>
        <button
          className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-accent"
          onClick={async () => { await api.markFeedback(f.id, !f.doneAt); await load(); }}
        >
          {f.doneAt ? 'Undo' : 'Done'}
        </button>
      </div>
    </li>
  );

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="testing">
      <div className="flex items-center justify-between gap-3">
        <h2 id="testing" className="text-lg font-bold">Testing phase</h2>
        <button
          role="switch"
          aria-checked={state.testing.on}
          aria-label="Testing phase"
          onClick={() => save({ testing: !state.testing.on })}
          className={`relative h-[30px] w-[50px] shrink-0 rounded-full ${state.testing.on ? 'bg-accent' : 'bg-line-strong'}`}
        >
          <span className={`absolute top-[3px] size-6 rounded-full bg-white shadow ${state.testing.on ? 'left-[23px]' : 'left-[3px]'}`} />
        </button>
      </div>
      <p className="text-muted">{state.testing.on ? 'Every screen shows a “Test version” strip with a feedback button.' : 'Off: no strip, no feedback button.'}</p>
      <label className="flex flex-col gap-1.5">
        <span className="label">What we&apos;re trying out</span>
        <div className="flex gap-2">
          <input
            value={note ?? state.testing.note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-2xl border-[1.5px] border-line-strong px-3.5"
          />
          <button className="btn btn-secondary" disabled={note === null || note === state.testing.note} onClick={async () => { await save({ testingNote: note ?? '' }); setNote(null); toast('Saved'); }}>Save</button>
        </div>
      </label>
      <h3 className="label mt-2">Feedback {items ? `(${open.length} new)` : ''}</h3>
      {items === null && <p className="text-muted">Loading…</p>}
      {items && !items.length && <p className="text-muted">Nothing yet.</p>}
      <ul>{open.map(row)}</ul>
      {done.length > 0 && (
        <button className="self-start text-sm font-bold text-accent" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} {done.length} done</button>
      )}
      {showDone && <ul className="opacity-70">{done.map(row)}</ul>}
    </section>
  );
}
