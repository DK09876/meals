'use client';

/** A sheet that rises from the bottom of the screen, for choices that belong to the page under it. */

import { useEffect, useRef } from 'react';

import { Icon } from './ui';

export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      aria-label={title}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/35 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="flex flex-col gap-4 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[22px] font-bold leading-tight">{title}</h2>
          <button onClick={() => ref.current?.close()} className="iconbtn" aria-label="Close"><Icon name="fail" size={18} /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
