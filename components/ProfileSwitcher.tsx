'use client';

/** "Cooking for Grandma" in the header; tap it to cook for someone else. */

import { useEffect, useRef, useState } from 'react';

import AddProfile from './AddProfile';
import { useData } from './DataProvider';
import { Avatar } from './ProfileGate';
import { Icon } from './ui';
import * as api from '@/lib/api';
import { setProfile, useProfile, type Profile } from '@/lib/profile';

export default function ProfileSwitcher() {
  const { state } = useData();
  const active = useProfile();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    api.fetchProfiles().then(setProfiles).catch(() => {});
  }, [open]);

  const close = () => { dialog.current?.close(); setOpen(false); };
  const pick = (id: string) => { close(); if (id !== active) setProfile(id); };
  const name = state?.profile.name ?? '';

  return (
    <>
      <button onClick={() => setOpen(true)} className="-ml-1 flex min-h-11 items-center gap-2.5 rounded-xl px-1 text-left" aria-haspopup="dialog">
        {name && <Avatar name={name} />}
        <span className="text-[15px] font-bold">Cooking for {name || '…'}</span>
        <Icon name="down" size={18} className="text-muted" />
      </button>
      {open && (
        <dialog
          ref={dialog}
          onClose={() => setOpen(false)}
          onClick={(e) => { if (e.target === dialog.current) close(); }}
          className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/30 sm:m-auto sm:max-w-md sm:rounded-3xl"
        >
          <div className="flex flex-col gap-4 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Who are you cooking for?</h2>
              <button onClick={close} className="iconbtn" aria-label="Close"><Icon name="fail" size={18} /></button>
            </div>
            <ul className="flex flex-col gap-2">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button onClick={() => pick(p.id)} aria-current={p.id === active} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left font-bold ${p.id === active ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                    <Avatar name={p.name} />
                    <span className="flex-1">{p.name}</span>
                    {p.id === active && <Icon name="ok" size={20} className="text-accent" />}
                  </button>
                </li>
              ))}
            </ul>
            <AddProfile onAdded={(p) => pick(p.id)} />
          </div>
        </dialog>
      )}
    </>
  );
}
