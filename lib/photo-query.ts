/**
 * Search phrases that find a photo of the dish rather than of its name, best
 * first. Commons search needs every word to match, so long recipe names are
 * tried again with fewer words. Shared by the server and the picker.
 */

const STOP = /\b(with|and|my|plate|adjusted|the|a|of|on|in|\d+)\b/gi;

export function photoQueries(name: string, hint?: string): string[] {
  const words = name.replace(/[&,()]/g, ' ').replace(STOP, ' ').split(/\s+/).filter(Boolean);
  const out = [hint, words.join(' '), words.slice(0, 3).join(' '), words.slice(0, 2).join(' '), words.slice(-2).join(' ')]
    .filter((q): q is string => !!q && q.trim().length > 2);
  return [...new Set(out)];
}

export const photoQuery = (name: string, hint?: string) => photoQueries(name, hint)[0] ?? name;
