/**
 * Photos without anyone having to ask: once per server start, every recipe
 * that has none gets the best Wikimedia Commons match, one at a time, in the
 * background. A fresh install shows photos within a minute or two instead of
 * plate drawings until someone finds the admin button. Never under tests.
 */

import { CATALOG } from './catalog';
import { getPhoto } from './db';
import { fetchCommonsImage, findPhoto, storePhoto } from './photos';

let started = false;

export function ensurePhotos(): void {
  if (started || process.env.VITEST || process.env.MEALS_NO_AUTO_PHOTOS) return;
  started = true;
  void (async () => {
    for (const meal of CATALOG) {
      if (getPhoto(meal.id)) continue;
      try {
        const c = await findPhoto(meal.name, meal.photo);
        if (c) storePhoto(meal.id, await fetchCommonsImage(c.thumb), c);
      } catch (e) {
        console.error(`photo for ${meal.id}:`, e instanceof Error ? e.message : e);
      }
    }
  })();
}
