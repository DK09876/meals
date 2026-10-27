'use client';

/** "Add a person": a name, and you are cooking for them. */

import { useState } from 'react';

import * as api from '@/lib/api';
import type { Profile } from '@/lib/profile';

export default function AddProfile({ onAdded }: { onAdded: (profile: Profile) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
          onAdded(await api.createProfile(name.trim()));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not add them');
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name, like Grandma"
          aria-label="Name"
          maxLength={30}
          className="min-h-12 min-w-0 flex-1 rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 outline-none focus:border-accent"
        />
        <button disabled={busy || !name.trim()} className="btn btn-primary">{busy ? 'Adding…' : 'Add'}</button>
      </div>
      {error && <p className="text-[15px] text-fail-fg">{error}</p>}
    </form>
  );
}
