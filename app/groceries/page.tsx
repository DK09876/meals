'use client';

/**
 * Groceries: what the planned meals need over this week or next, minus what
 * is at home. Each item opens Instacart already searching for it at your
 * store; "Got it" puts it on the at-home list. Share or copy the whole list.
 */

import { useMemo, useState } from 'react';

import AdminGate from '@/components/AdminGate';
import { useData } from '@/components/DataProvider';
import { useToast } from '@/components/Toast';
import { Icon, Segmented } from '@/components/ui';
import * as api from '@/lib/api';
import { addDays, monthDay } from '@/lib/dates';
import { GROUPS } from '@/lib/foods';
import { groceryList, groceryText, instacartLink, isStoreSlug } from '@/lib/grocery';

export default function GroceriesPage() {
  return <AdminGate><Groceries /></AdminGate>;
}

const STORES = ['costco', 'safeway', 'kroger', 'albertsons', 'sprouts', 'aldi', 'publix', 'wegmans', 'heb', 'smart-and-final', 'food-lion', 'cvs'];

function Groceries() {
  const { state, world, today, pantry, setPantry, refresh } = useData();
  const toast = useToast();
  const [week, setWeek] = useState<'this' | 'next'>('this');
  const [editingStore, setEditingStore] = useState(false);
  const [store, setStore] = useState('');
  const from = week === 'this' ? today : addDays(today, 7);
  const list = useMemo(() => (world ? groceryList(world, from, 7, pantry) : null), [world, from, pantry]);
  if (!state || !list) return null;

  const need = list.lines.filter((l) => !l.atHome);
  const home = list.lines.filter((l) => l.atHome);
  const title = `Groceries for ${state.profile.name}, ${monthDay(from)}–${monthDay(addDays(from, 6))}`;
  const text = groceryText(list.lines, title);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, text });
      else { await navigator.clipboard.writeText(text); toast('List copied'); }
    } catch { /* the share sheet was closed */ }
  };

  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight">Groceries</h1>
      <Segmented label="Which week" options={[{ id: 'this', label: 'This week' }, { id: 'next', label: 'Next week' }]} value={week} onChange={setWeek} />

      <p className="text-muted">
        {list.mealCount ? `${list.mealCount} planned meals from ${monthDay(from)} need ${need.length} ${need.length === 1 ? 'item' : 'items'}${home.length ? `; ${home.length} already at home` : ''}.` : 'Nothing is planned for these days yet. Plan the week first.'}
      </p>

      <section className="card flex flex-col gap-3" aria-labelledby="store">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f5e1] text-[#2c7a1f]" aria-hidden="true"><Icon name="cart" size={22} /></span>
          <span className="flex flex-1 flex-col">
            <span id="store" className="font-bold">Instacart store</span>
            <span className="text-sm text-muted">{state.store ? state.store : 'Any store - Instacart asks'}</span>
          </span>
          <button className="btn btn-secondary min-h-11 px-3 text-[15px]" onClick={() => { setStore(state.store); setEditingStore(!editingStore); }}>{editingStore ? 'Close' : 'Change'}</button>
        </div>
        {editingStore && (
          <form
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const slug = store.trim().toLowerCase();
              if (!isStoreSlug(slug)) { toast('Use the word after /store/ in the Instacart address'); return; }
              try { await api.setStore(slug); await refresh(); setEditingStore(false); toast(slug ? `Links now search ${slug}` : 'Links search any store'); } catch (err) { toast(err instanceof Error ? err.message : 'Could not save'); }
            }}
          >
            <input list="stores" value={store} onChange={(e) => setStore(e.target.value)} placeholder="costco" aria-label="Store" className="min-h-12 rounded-2xl border-[1.5px] border-line-strong px-3.5" />
            <datalist id="stores">{STORES.map((s) => <option key={s} value={s} />)}</datalist>
            <p className="text-sm text-muted">Open your store on instacart.com - its address ends in /store/<b>name</b>. Leave empty to choose each time.</p>
            <button className="btn btn-primary">Save store</button>
          </form>
        )}
      </section>

      {GROUPS.concat([{ id: 'extra' as never, label: 'Sauces', hint: '', color: '#888' }]).map((g) => {
        const rows = need.filter((l) => l.group === g.id);
        if (!rows.length) return null;
        return (
          <section key={g.id} className="card px-4.5 pb-1 pt-3.5" aria-labelledby={`gl-${g.id}`}>
            <h2 id={`gl-${g.id}`} className="label mb-1 flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: g.color }} />{g.label}
            </h2>
            <ul>
              {rows.map((l) => (
                <li key={l.food} className="flex items-center gap-3 border-t border-line-soft py-2.5">
                  <button onClick={() => setPantry(l.food, true)} aria-label={`Got ${l.search}`} className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#9aa39c] text-transparent hover:text-accent">
                    <Icon name="ok" size={20} stroke={3} />
                  </button>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold capitalize-first">{l.search}</span>
                    <span className="text-sm text-muted">{l.amount} · {l.meals.length === 1 ? l.meals[0] : `${l.meals.length} meals`}</span>
                  </span>
                  <a href={instacartLink(l.food, state.store)} target="_blank" rel="noreferrer" aria-label={`Find ${l.search} on Instacart`} className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-[#e8f5e1] px-3 text-sm font-bold text-[#1f5c14]">
                    <Icon name="cart" size={18} />Find
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {need.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <button className="btn btn-primary" onClick={share}><Icon name="next" size={20} />Share list</button>
          <button className="btn btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(text); toast('List copied'); } catch { toast('Could not copy'); } }}>Copy</button>
        </div>
      )}
      {list.mealCount > 0 && !need.length && <p className="card text-center font-bold text-ok-fg">Everything for these meals is at home.</p>}

      {home.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-bold">Already at home ({home.length})</summary>
          <ul className="mt-2">
            {home.map((l) => (
              <li key={l.food} className="flex items-center gap-3 border-t border-line-soft py-2">
                <span className="flex flex-1 flex-col"><span>{l.search}</span><span className="text-sm text-muted">{l.amount}</span></span>
                <button className="min-h-11 rounded-xl px-3 text-sm font-bold text-accent" onClick={() => setPantry(l.food, false)}>Need more</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-center text-sm text-muted">Instacart can&apos;t filter for low sodium, so the list names the no-salt-added version. Check labels when choosing.</p>
    </>
  );
}
