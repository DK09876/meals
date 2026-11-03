'use client';

/** Admin: pick a freely licensed photo from Wikimedia Commons, or upload one of your own. */

/* eslint-disable @next/next/no-img-element -- thumbnails come straight from Commons */

import { useEffect, useState } from 'react';

import { useData } from './DataProvider';
import Sheet from './Sheet';
import { Icon } from './ui';
import * as api from '@/lib/api';
import type { Meal } from '@/lib/catalog';
import { photoQuery } from '@/lib/photo-query';

export default function PhotoPicker({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { refresh } = useData();
  const [q, setQ] = useState(photoQuery(meal.name, meal.photo));
  const [results, setResults] = useState<api.Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (query: string) => {
    setResults(null);
    setError(null);
    try { setResults(await api.searchPhotos(query)); } catch (e) { setError(e instanceof Error ? e.message : 'Search failed'); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- search once on open
  useEffect(() => { search(q); }, []);

  const done = async (work: Promise<unknown>) => {
    setBusy(true);
    try { await work; await refresh(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save that photo'); } finally { setBusy(false); }
  };

  return (
    <Sheet title="Choose a photo" onClose={onClose}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search photos" className="min-h-12 min-w-0 flex-1 rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 outline-none focus:border-accent" />
        <button className="btn btn-secondary" aria-label="Search"><Icon name="search" size={20} /></button>
      </form>
      {error && <p className="text-fail-fg" role="alert">{error}</p>}
      {!results && !error && <p className="text-muted">Searching Wikimedia Commons…</p>}
      {results && !results.length && <p className="text-muted">No photos found. Try fewer words.</p>}
      <ul className="grid grid-cols-2 gap-3">
        {results?.map((c) => (
          <li key={c.thumb}>
            <button disabled={busy} onClick={() => done(api.choosePhoto(meal.id, c))} className="flex w-full flex-col gap-1 text-left">
              <img src={c.thumb} alt={c.title} className="aspect-[4/3] w-full rounded-xl bg-field object-cover" />
              <span className="line-clamp-1 text-xs text-muted">{c.credit || 'Unknown'} · {c.license}</span>
            </button>
          </li>
        ))}
      </ul>
      <label className="btn btn-secondary cursor-pointer">
        <Icon name="camera" size={20} />Use your own photo
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) done(api.uploadPhoto(meal.id, f)); }} />
      </label>
      <p className="text-center text-xs text-muted">Photos from Wikimedia Commons are free to use with credit, which is shown under each one.</p>
    </Sheet>
  );
}
