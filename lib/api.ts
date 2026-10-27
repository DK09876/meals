/**
 * Client-side calls into our own API, with errors that say something.
 * Every call says which profile it is for; data routes refuse one that does not.
 */

import type { Meal } from './catalog';
import type { LogEntry } from './history';
import { getProfile, type Profile } from './profile';
import type { Item, MealType, Rules } from './rules';

export interface AppState {
  profile: Profile;
  rules: Rules;
  rulesUpdatedAt: string;
  saved: string[];
  pantry: string[];
  custom: Meal[];
  log: LogEntry[];
}

const url = (path: string) => {
  const profile = getProfile();
  if (!profile) return `/api/${path}`;
  return `/api/${path}${path.includes('?') ? '&' : '?'}profile=${encodeURIComponent(profile)}`;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown>) {
    super(message);
  }
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError((body as { error?: string }).error || `Request failed (${response.status})`, response.status, body);
  }
  return body as T;
}

const send = <T>(path: string, method: string, body?: object) =>
  fetch(url(path), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(json<T>);

export const fetchProfiles = () => fetch(url('profiles')).then(json<{ profiles: Profile[] }>).then((b) => b.profiles);
export const createProfile = (name: string) => send<{ profile: Profile }>('profiles', 'POST', { name }).then((b) => b.profile);

/** The state, and the build the server is running. */
export async function fetchState(): Promise<{ state: AppState; build: string | null }> {
  const response = await fetch(url('state'), { cache: 'no-store' });
  return { state: await json<AppState>(response), build: response.headers.get('x-meals-build') };
}

export const patchRules = (changes: Partial<Rules>, base: string) =>
  send<{ rules: Rules; rulesUpdatedAt: string }>('rules', 'PATCH', { changes, base });

export const setSaved = (mealId: string, on: boolean) => send<{ ok: true }>('saved', 'PUT', { mealId, on });
export const setPantry = (foodId: string, on: boolean) => send<{ ok: true }>('pantry', 'PUT', { foodId, on });
export const logMeal = (mealId: string) => send<{ entry: LogEntry }>('log', 'POST', { mealId }).then((b) => b.entry);
export const unlog = (id: string) => send<{ ok: true }>(`log?id=${encodeURIComponent(id)}`, 'DELETE');
export const addMeal = (type: MealType, items: Item[], name?: string) => send<{ meal: Meal }>('meals', 'POST', { type, items, name }).then((b) => b.meal);
export const deleteMeal = (id: string) => send<{ ok: true }>(`meals/${encodeURIComponent(id)}`, 'DELETE');
