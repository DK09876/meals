/**
 * Reload a page left open across a deploy, once per new build - as LifeOS
 * does. The guard in sessionStorage means a server whose build cannot be
 * matched (a header lost on the way) costs one reload, not a loop.
 */

export const CLIENT_BUILD = process.env.NEXT_PUBLIC_MEALS_BUILD ?? '';
const KEY = 'meals-reloaded-for';

export function shouldReload(clientBuild: string, serverBuild: string | null, alreadyTriedFor: string | null): boolean {
  return !!serverBuild && !!clientBuild && serverBuild !== clientBuild && alreadyTriedFor !== serverBuild;
}

export function reloadIfOutdated(serverBuild: string | null): boolean {
  let tried: string | null = null;
  try { tried = sessionStorage.getItem(KEY); } catch { /* no storage: still reload once */ }
  if (!shouldReload(CLIENT_BUILD, serverBuild, tried)) return false;
  try { sessionStorage.setItem(KEY, serverBuild!); } catch { /* see above */ }
  window.location.reload();
  return true;
}
