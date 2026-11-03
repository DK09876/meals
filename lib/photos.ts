/**
 * Recipe photos, from Wikimedia Commons: freely licensed pictures, searched
 * by dish name, with the photographer and licence kept for the credit line.
 * Chosen photos are saved on the Pi beside the database (never in the
 * public repo) and served from there; the family can also upload their own.
 *
 * The network call is injectable so tests never reach Wikimedia.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { DATA_DIR, savePhotoRow } from './db';
import { photoQueries } from './photo-query';

export const PHOTO_DIR = process.env.MEALS_PHOTO_DIR || join(DATA_DIR, 'photos');
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const UA = 'meals-app/0.2 (private family app; https://github.com/DK09876/meals)';

export interface Candidate {
  title: string;
  /** A ~800 px wide copy, from Wikimedia's image hosts. */
  thumb: string;
  page: string;
  license: string;
  credit: string;
}

type Fetch = typeof fetch;

const ARTWORK = /\b(WGA\d+|chardin|painting|still life|stilleben|nature morte|renoir|winck|lithograph|engraving|illustration|drawing|poster|menu)\b/i;

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export async function searchCommons(query: string, fetcher: Fetch = fetch, limit = 8): Promise<Candidate[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: String(limit),
    gsrsearch: `${query} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '800',
  }).toString();
  const res = await fetcher(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Photo search failed (${res.status})`);
  const body = await res.json() as { query?: { pages?: Record<string, { index?: number; title: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }> }> } };
  return Object.values(body.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? '')) return [];
      // Paintings and drawings of food are not what dinner looks like.
      if (ARTWORK.test(p.title)) return [];
      const meta = info.extmetadata ?? {};
      return [{
        title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        thumb: info.thumburl,
        page: info.descriptionurl ?? '',
        license: stripTags(meta.LicenseShortName?.value ?? ''),
        credit: stripTags(meta.Artist?.value ?? '').slice(0, 120),
      }];
    });
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** What the bytes really are, whatever the upload claimed. */
export function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

const safeId = (mealId: string) => mealId.replace(/[^a-zA-Z0-9-]/g, '_');

export function storePhoto(mealId: string, bytes: Uint8Array, meta: { credit: string; license: string; page: string }): void {
  const mime = sniff(bytes);
  if (!mime) throw new Error('That is not a JPEG, PNG or WebP picture');
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('That picture is too big (6 MB at most)');
  mkdirSync(PHOTO_DIR, { recursive: true });
  const file = `${safeId(mealId)}-${Date.now()}.${EXT[mime]}`;
  writeFileSync(join(PHOTO_DIR, file), bytes);
  savePhotoRow({ mealId, file, mime, ...meta });
}

export const readPhoto = (file: string) => readFileSync(join(PHOTO_DIR, file));

/** Downloads a chosen Commons picture. Only Wikimedia's own image host is allowed. */
export async function fetchCommonsImage(thumb: string, fetcher: Fetch = fetch): Promise<Uint8Array> {
  const url = new URL(thumb);
  // Commons serves full files from upload.wikimedia.org and sized copies from thumb.wikimedia.org.
  if (url.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) throw new Error('Only Wikimedia Commons pictures can be fetched');
  const res = await fetcher(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Could not download that picture (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('That picture is too big');
  return bytes;
}

export { photoQuery, photoQueries } from './photo-query';

const keywords = (text: string) => [...new Set(text.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !['with', 'plate', 'adjusted', 'fresh', 'bowl', 'sliced'].includes(w)))];

/** How many of the dish's words a photo's title has, as whole words ("turkey" is not "turkish"). */
export function matchScore(title: string, words: string[]): number {
  const t = ` ${title.toLowerCase().replace(/[^a-z ]/g, ' ')} `;
  return words.filter((w) => new RegExp(`\\b${w}(s|es)?\\b`).test(t)).length;
}

/**
 * The best photo the meal's search phrases find: the one whose title shares
 * the most words with the dish, needing at least two (or the only one there is).
 * Nothing rather than something unrelated - a missing photo shows the plate drawing.
 */
export async function findPhoto(name: string, hint: string | undefined, fetcher: Fetch = fetch): Promise<Candidate | null> {
  const words = keywords(`${hint ?? ''} ${name}`);
  const need = Math.min(2, words.length);
  let best: { c: Candidate; score: number } | null = null;
  for (const q of photoQueries(name, hint).slice(0, 3)) {
    for (const c of await searchCommons(q, fetcher, 8)) {
      const score = matchScore(c.title, words);
      if (score >= need && (!best || score > best.score)) best = { c, score };
    }
    if (best && best.score >= Math.min(3, words.length)) break;
  }
  return best?.c ?? null;
}
