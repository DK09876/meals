'use client';

/** After a meal: did she like it? A favourite comes up more; "not for me" is never suggested again. */

import { useData } from './DataProvider';
import Sheet from './Sheet';
import type { Meal } from '@/lib/catalog';

export default function LikePrompt({ meal, onClose, grandma }: { meal: Meal; onClose: () => void; grandma: boolean }) {
  const { setLike } = useData();
  const pick = (v: 1 | -1) => { setLike(meal.id, v); onClose(); };
  return (
    <Sheet title={grandma ? 'Did you like it?' : 'Did she like it?'} onClose={onClose}>
      <p className="-mt-2 text-muted">{meal.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <button className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-accent bg-accent-soft text-lg font-bold text-accent-ink" onClick={() => pick(1)}>
          <span aria-hidden="true" className="text-4xl">👍</span>Yes
        </button>
        <button className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-line-strong bg-surface text-lg font-bold" onClick={() => pick(-1)}>
          <span aria-hidden="true" className="text-4xl">👎</span>Not for me
        </button>
      </div>
      <p className="text-center text-sm text-muted">Liked meals come up more often. &ldquo;Not for me&rdquo; ones stop being suggested.</p>
      <button className="btn btn-secondary" onClick={onClose}>Skip</button>
    </Sheet>
  );
}
