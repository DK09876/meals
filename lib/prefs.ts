/**
 * Small display choices remembered on this phone only - "use what's at
 * home" - kept in localStorage, guarded, and harmless to lose.
 */

import { useCallback, useState } from 'react';

export function usePref(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = localStorage.getItem(`meals-${key}`);
      return stored === null ? initial : stored === '1';
    } catch {
      return initial;
    }
  });
  const set = useCallback((v: boolean) => {
    setValue(v);
    try { localStorage.setItem(`meals-${key}`, v ? '1' : '0'); } catch { /* lasts until the page closes */ }
  }, [key]);
  return [value, set];
}
