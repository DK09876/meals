'use client';

/**
 * One message at a time along the bottom, above the tab bar - "Logged lunch",
 * with an Undo where there is something to undo. Read out by screen readers.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

type Show = (text: string, action?: ToastMessage['action']) => void;

const ToastContext = createContext<Show>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<Show>((text, action) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, action });
    // Longer when there is an Undo to reach for.
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 3200);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
        {toast && (
          <div key={toast.id} className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[15px] font-bold text-white shadow-lg">
            <span className="flex-1">{toast.text}</span>
            {toast.action && (
              <button
                onClick={() => { toast.action!.run(); setToast(null); }}
                className="-my-2 min-h-11 rounded-lg px-3 text-[#9FD8B8] underline-offset-2 hover:underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
