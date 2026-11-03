'use client';

/**
 * Wraps admin screens: shows them once this phone is signed in, and the
 * password form until then (or "choose a password" the very first time).
 */

import { useState } from 'react';

import { useData } from './DataProvider';
import { Icon } from './ui';
import * as api from '@/lib/api';
import { setMode } from '@/lib/mode';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useData();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  if (state.admin) return <>{children}</>;
  const first = !state.adminConfigured;

  return (
    <div className="card mt-4 flex flex-col gap-4">
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon name="lock" size={24} /></span>
      <div>
        <h1 className="text-2xl font-bold">{first ? 'Choose an admin password' : 'Admin mode'}</h1>
        <p className="mt-1 text-muted">{first ? 'The family uses it to change her limits, groceries and photos. Grandma never needs it.' : 'Enter the admin password to change her limits, groceries and photos.'}</p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.adminAction({ action: first ? 'setup' : 'login', password });
            setPassword('');
            await refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not sign in');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="label">Password</span>
          <input
            type="password"
            autoComplete={first ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 outline-none focus:border-accent"
          />
        </label>
        {error && <p className="text-fail-fg" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy || password.length < (first ? 4 : 1)}>{busy ? 'Checking…' : first ? 'Set password' : 'Unlock'}</button>
      </form>
      <button className="btn btn-secondary" onClick={() => setMode('grandma')}>Back to Grandma&apos;s view</button>
    </div>
  );
}
