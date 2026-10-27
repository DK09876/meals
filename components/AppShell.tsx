'use client';

/**
 * The frame around every screen: who the food is for, the screen itself,
 * and the tab bar along the bottom where a thumb reaches it.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useProfile } from '@/lib/profile';

import DataProvider, { useData } from './DataProvider';
import ProfileGate from './ProfileGate';
import ProfileSwitcher from './ProfileSwitcher';
import { ToastProvider } from './Toast';
import { Icon, type IconName } from './ui';

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/', label: 'Ideas', icon: 'bulb' },
  { href: '/build', label: 'Build', icon: 'plate' },
  { href: '/pantry', label: 'At home', icon: 'home' },
  { href: '/saved', label: 'Saved', icon: 'bookmark' },
  { href: '/plan', label: 'Her plan', icon: 'sliders' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ProfileGate>
        <ForProfile>{children}</ForProfile>
      </ProfileGate>
    </ToastProvider>
  );
}

/** Everything below starts afresh when the phone switches person. */
function ForProfile({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  return (
        <DataProvider key={profile}>
          <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
            <Header />
            <main className="safe-x flex flex-1 flex-col gap-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-1">
              <Body>{children}</Body>
            </main>
          </div>
          <TabBar />
        </DataProvider>
  );
}

function Header() {
  return (
    <header className="safe-x flex items-center justify-between pb-2 pt-[max(14px,env(safe-area-inset-top))]">
      <ProfileSwitcher />
      <span className="text-[15px] text-muted">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
    </header>
  );
}

/** Waits for the first load, and says so plainly if the Pi cannot be reached. */
function Body({ children }: { children: React.ReactNode }) {
  const { state, error, refresh } = useData();
  if (state) return <>{children}</>;
  if (error) {
    return (
      <div className="card mt-8 flex flex-col gap-3 text-center">
        <h1 className="text-xl font-bold">Can&apos;t load her meals</h1>
        <p className="text-muted">{error}</p>
        <button className="btn btn-primary" onClick={() => refresh()}>Try again</button>
      </div>
    );
  }
  return <p className="mt-8 text-center text-muted">Loading…</p>;
}

function TabBar() {
  const path = usePathname();
  const current = (href: string) => (href === '/' ? path === '/' || path.startsWith('/meal/') : path.startsWith(href));
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-5 px-1.5 pt-1.5">
        {TABS.map((t) => {
          const on = current(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-13 flex-col items-center justify-center gap-0.5 text-xs font-bold ${on ? 'text-accent' : 'text-[#5f6862]'}`}
              >
                <Icon name={t.icon} size={24} stroke={2} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
