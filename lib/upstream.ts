/**
 * A copy of the app run somewhere else - a throwaway one on a laptop - can
 * borrow the Pi's voice typing and recipe chat: set MEALS_UPSTREAM to the
 * Pi's address (https://meals.<tailnet>.ts.net) and the phone or laptop
 * still records with its own microphone, but the audio and questions go on
 * to the Pi. The model keys and whisper never leave the Pi.
 *
 * Requests go to the Pi's profile named by MEALS_UPSTREAM_PROFILE
 * (default "grandma"), so chat answers use that profile's limits.
 */

export function upstreamUrl(path: string): string | null {
  const base = process.env.MEALS_UPSTREAM?.replace(/\/+$/, '');
  if (!base) return null;
  const profile = process.env.MEALS_UPSTREAM_PROFILE || 'grandma';
  return `${base}/api/${path}?profile=${encodeURIComponent(profile)}`;
}
