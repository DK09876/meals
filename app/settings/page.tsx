'use client';

/** Admin settings: her limits, recipe photos, the admin password, and locking admin mode on this phone. */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import AdminGate from '@/components/AdminGate';
import { useData } from '@/components/DataProvider';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/ui';
import * as api from '@/lib/api';
import { setMode } from '@/lib/mode';
import Limits from './limits';

export default function SettingsPage() {
  return (
    <AdminGate>
      <h1 className="text-[30px] font-bold leading-tight">Settings</h1>
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
