'use client';

/**
 * The frame around every screen: who the food is for, the screen itself,
 * and the tab bar along the bottom where a thumb reaches it.
 *
 * Grandma's view (the default) has three big tabs - her week, recipes, and
 * asking for ideas. The admin view adds groceries, the at-home list and
 * settings, behind the admin password.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import DataProvider, { useData } from './DataProvider';
import { TestingBanner } from './Feedback';
import ProfileGate from './ProfileGate';
import ProfileSwitcher from './ProfileSwitcher';
import { ToastProvider } from './Toast';
import { Icon, type IconName } from './ui';
import { setMode, useMode } from '@/lib/mode';
import { useProfile } from '@/lib/profile';

interface Tab { href: string; label: string; icon: IconName; also?: string[] }

const GRANDMA_TABS: Tab[] = [
  { href: '/', label: 'My week', icon: 'calendar' },
  { href: '/recipes', label: 'Recipes', icon: 'bulb', also: ['/meal/'] },
  { href: '/ask', label: 'Ask', icon: 'chat' },
];

const ADMIN_TABS: Tab[] = [
  { href: '/', label: 'Week', icon: 'calendar' },
  { href: '/recipes', label: 'Recipes', icon: 'bulb', also: ['/meal/', '/build'] },
  { href: '/groceries', label: 'Groceries', icon: 'cart' },
  { href: '/pantry', label: 'At home', icon: 'home' },
  { href: '/settings', label: 'Settings', icon: 'sliders', also: ['/history', '/ask'] },
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
        <TestingBanner />
        <main className="safe-x flex flex-1 flex-col gap-4 pb-[calc(100px+env(safe-area-inset-bottom))] pt-3">
          <Body>{children}</Body>
        </main>
      </div>
      <TabBar />
    </DataProvider>
  );
}

/** Screens that only exist in admin mode; leaving admin on one goes back to her week. */
const ADMIN_ONLY = ['/groceries', '/pantry', '/settings', '/build', '/history'];

function Header() {
  const mode = useMode();
  const { state } = useData();
  const path = usePathname();
  const router = useRouter();
  if (mode === 'admin') {
    return (
      <header className="safe-x flex items-center justify-between gap-2 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <ProfileSwitcher />
        <button onClick={() => { setMode('grandma'); if (ADMIN_ONLY.some((p) => path.startsWith(p))) router.push('/'); }} className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent-soft px-3 text-[15px] font-bold text-accent-ink">
          Exit admin
        </button>
      </header>
    );
  }
  return (
    <header className="safe-x flex items-center justify-between gap-2 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
      <span className="text-lg font-bold">Hi, {state?.profile.name ?? '…'}</span>
      <button onClick={() => setMode('admin')} aria-label="Admin mode" className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] text-muted">
        <Icon name="lock" size={18} />Admin
      </button>
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
        <h1 className="text-xl font-bold">Can&apos;t load the meals</h1>
        <p className="text-muted">{error}</p>
        <button className="btn btn-primary" onClick={() => refresh()}>Try again</button>
      </div>
    );
  }
  return <p className="mt-8 text-center text-muted">Loading…</p>;
}

function TabBar() {
  const path = usePathname();
  const mode = useMode();
  const tabs = mode === 'admin' ? ADMIN_TABS : GRANDMA_TABS;
  const current = (t: Tab) => (t.href === '/' ? path === '/' : path.startsWith(t.href)) || !!t.also?.some((p) => path.startsWith(p));
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="mx-auto grid max-w-xl px-1.5 pt-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const on = current(t);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 font-bold ${mode === 'admin' ? 'min-h-13 text-xs' : 'min-h-15 text-sm'} ${on ? 'text-accent' : 'text-[#5f6862]'}`}
              >
                <Icon name={t.icon} size={mode === 'admin' ? 24 : 28} stroke={2} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
