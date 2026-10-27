'use client';

/**
 * Asks who the food is for - once per phone - before showing the app.
 *
 * A remembered choice is used straight away; the list only checks it
 * afterwards, in case that person has been removed. Never falls back to a
 * default: a new phone landing in someone else's limits is the one thing
 * profiles are here to prevent.
 */

import { useEffect, useState } from 'react';

import AddProfile from './AddProfile';
import * as api from '@/lib/api';
import { getProfile, setProfile, useProfile, type Profile } from '@/lib/profile';

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const active = useProfile();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchProfiles()
      .then((found) => {
        setProfiles(found);
        const remembered = getProfile();
        if (remembered && !found.some((p) => p.id === remembered)) setProfile('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not reach the server'));
  }, []);

  if (active === null) return null;
  if (active) return <>{children}</>;

  return (
    <div className="safe-x mx-auto flex max-w-sm flex-col gap-5 pt-[max(64px,env(safe-area-inset-top))]">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Who are you cooking for?</h1>
        <p className="mt-1 text-muted">Each person has their own limits, saved meals and history.</p>
      </div>
      {error && <p className="text-fail-fg">{error}</p>}
      {!profiles && !error && <p className="text-muted">Loading…</p>}
      {!!profiles?.length && (
        <ul className="flex flex-col gap-2">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button onClick={() => setProfile(profile.id)} className="card flex w-full items-center gap-3 text-left text-lg font-bold">
                <Avatar name={profile.name} />
                {profile.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {profiles && (
        <div>
          <p className="mb-2 text-muted">{profiles.length ? 'Someone new?' : 'Add the first person:'}</p>
          <AddProfile onAdded={(p) => setProfile(p.id)} />
        </div>
      )}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base font-bold text-accent-ink">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
