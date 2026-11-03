'use client';

/**
 * Ask: "something with chicken", "a quick breakfast", "what can I make with
 * what's at home?" - answered with recipes that fit her plan. Every recipe is
 * checked by the app (lib/chat.ts), and can be saved or added to her week.
 * The conversation stays on this phone until "New chat".
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import AddToWeek from '@/components/AddToWeek';
import { useData } from '@/components/DataProvider';
import MicButton from '@/components/MicButton';
import { Chips, Icon } from '@/components/ui';
import * as api from '@/lib/api';
import type { Meal } from '@/lib/catalog';
import { useMode } from '@/lib/mode';
import { slotContext } from '@/lib/plan';
import { evaluate, mealTypeLabel, NOTHING_EATEN } from '@/lib/rules';

type Turn = { role: 'user'; content: string } | { role: 'assistant'; content: string; reply: api.ChatReply };

const KEY = 'meals-chat';
const STARTERS = ['Something with chicken', 'A quick breakfast', 'What can I make with what’s at home?', 'A light dinner', 'An afternoon snack', 'Something with dal'];

export default function AskPage() {
  const grandma = useMode() === 'grandma';
  const [turns, setTurns] = useState<Turn[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); } catch { return []; }
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-20))); } catch { /* fine */ }
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setText('');
    setBusy(true);
    setError(null);
    try {
      const history = next.slice(-10).map((t) => ({ role: t.role, content: t.role === 'assistant' ? `${t.content}${t.reply.recipes.length ? ` (Recipes: ${t.reply.recipes.map((r) => r.name).join(', ')})` : ''}` : t.content }));
      const reply = await api.askChat(history, grandma);
      setTurns([...next, { role: 'assistant', content: reply.reply, reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The recipe helper is busy. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[30px] font-bold leading-tight">Ask for ideas</h1>
        {turns.length > 0 && <button className="min-h-11 rounded-xl px-2 font-bold text-accent" onClick={() => { setTurns([]); setError(null); }}>New chat</button>}
      </div>

      {turns.length === 0 && (
        <section className="flex flex-col gap-3" aria-label="Ideas to ask">
          <p className="text-muted">Ask in your own words, or tap one of these. Every recipe is checked against {grandma ? 'your' : 'her'} plan.</p>
          <ul className="grid grid-cols-2 gap-2.5">
            {STARTERS.map((s) => (
              <li key={s}><button onClick={() => send(s)} className="flex min-h-16 w-full items-center rounded-2xl border-[1.5px] border-line bg-surface px-3.5 text-left text-[16px] font-bold">{s}</button></li>
            ))}
          </ul>
        </section>
      )}

      <ol className="flex flex-col gap-4" aria-live="polite">
        {turns.map((t, n) => (
          <li key={n} className={t.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-3'}>
            {t.role === 'user' ? (
              <span className="max-w-[85%] rounded-3xl rounded-br-lg bg-accent px-4 py-3 text-[17px] text-white">{t.content}</span>
            ) : (
              <>
                <p className="max-w-[92%] rounded-3xl rounded-bl-lg bg-surface px-4 py-3 text-[17px] shadow-sm">{t.content}</p>
                {t.reply.recipes.map((r, i) => <ChatRecipe key={i} recipe={r} />)}
                {t.reply.dropped.length > 0 && <p className="text-sm text-muted">Left out, because it used foods the app can&apos;t check or couldn&apos;t be made to fit the plan: {t.reply.dropped.join(', ')}.</p>}
              </>
            )}
          </li>
        ))}
        {busy && <li className="w-fit rounded-3xl bg-surface px-4 py-3 text-muted shadow-sm">Thinking of something that fits…</li>}
      </ol>
      {error && <p className="rounded-2xl bg-warn-bg px-4 py-3 font-bold text-warn-fg" role="alert">{error}</p>}
      <div ref={end} className="h-20" aria-hidden="true" />

      <form
        onSubmit={(e) => { e.preventDefault(); send(text); }}
        className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-20 -mx-2 flex items-end gap-2 rounded-3xl border border-line bg-surface p-2 shadow-lg"
      >
        <MicButton onText={(said) => setText((t) => (t ? `${t} ${said}` : said))} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Your question</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
            rows={1}
            placeholder="Ask for a meal idea…"
            className="block max-h-32 min-h-12 w-full resize-none rounded-2xl bg-field/60 px-3.5 py-3 outline-none"
          />
        </label>
        <button className="btn btn-primary min-h-12 px-4" disabled={!text.trim() || busy} aria-label="Send">
          <Icon name="next" size={22} stroke={2.6} />
        </button>
      </form>
    </>
  );
}

function ChatRecipe({ recipe }: { recipe: api.ChatReply['recipes'][number] }) {
  const { state, world, today, addMeal } = useData();
  const router = useRouter();
  const grandma = useMode() === 'grandma';
  const [saved, setSaved] = useState<Meal | null>(null);
  const [adding, setAdding] = useState<Meal | null>(null);
  if (!state) return null;
  // Checked against what today already has, as the week would check it.
  const e = evaluate(recipe.items, recipe.type, state.rules, world ? slotContext(world, today, recipe.type) : NOTHING_EATEN);

  const save = async () => {
    if (saved) return saved;
    const meal = await addMeal(recipe.type, recipe.items, { name: recipe.name, steps: recipe.steps, minutes: recipe.minutes, note: recipe.note, source: 'chat' });
    if (meal) setSaved(meal);
    return meal;
  };

  return (
    <article className="card flex flex-col gap-3" aria-label={recipe.name}>
      <div className="flex flex-col gap-0.5">
        <span className="label">{mealTypeLabel(recipe.type)}{recipe.minutes ? ` · ${recipe.minutes} min` : ''} · {Math.round(e.totals.carbs)} g carbs</span>
        <h2 className="text-[22px] font-bold leading-tight">{recipe.name}</h2>
      </div>
      {recipe.note && <p className="rounded-xl bg-accent-soft px-3 py-2 text-[15px] text-accent-ink">{recipe.note}</p>}
      <Chips checks={e.checks} />
      <ul className="flex flex-col gap-1 text-[16px]">
        {recipe.items.map((i) => <li key={i.food}>• {i.label}</li>)}
      </ul>
      {recipe.steps.length > 0 && (
        <details>
          <summary className="cursor-pointer py-1 font-bold text-accent">How to make it</summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">{recipe.steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
        </details>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <button className="btn btn-secondary" onClick={async () => { const m = await save(); if (m) router.push(`/meal/${m.id}`); }}>{saved ? 'Open' : 'Save'}</button>
        <button className="btn btn-primary" onClick={async () => { const m = await save(); if (m) setAdding(m); }}>
          <Icon name="calendar" size={20} />{grandma ? 'Add to my week' : 'Add to week'}
        </button>
      </div>
      {adding && <AddToWeek meal={adding} onClose={() => setAdding(null)} />}
    </article>
  );
}
