/**
 * Grandma view or admin view, remembered on this phone. Grandma's is the
 * default. Admin view only shows admin screens once this phone has signed
 * in with the admin password (see lib/admin.ts) - the server checks that on
 * every admin route regardless of what the phone shows.
 */

import { useSyncExternalStore } from 'react';

export type Mode = 'grandma' | 'admin';

const KEY = 'meals-mode';
const listeners = new Set<() => void>();

export function getMode(): Mode {
  if (typeof window === 'undefined') return 'grandma';
  try {
    return localStorage.getItem(KEY) === 'admin' ? 'admin' : 'grandma';
  } catch {
    return 'grandma';
  }
}

export function setMode(mode: Mode): void {
  try { localStorage.setItem(KEY, mode); } catch { /* lasts until the page closes */ }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const useMode = (): Mode => useSyncExternalStore(subscribe, getMode, () => 'grandma');
