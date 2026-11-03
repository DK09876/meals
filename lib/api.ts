/**
 * Client-side calls into our own API, with errors that say something.
 * Every call says which profile it is for; data routes refuse one that does not.
 */

import type { Meal } from './catalog';
import type { LogEntry } from './history';
import { getProfile, type Profile } from './profile';
import type { PlanEntry } from './plan';
import type { Item, MealType, Rules } from './rules';

export interface PhotoInfo { v: string; credit: string; license: string; page: string }

export interface AppState {
  profile: Profile;
  rules: Rules;
  rulesUpdatedAt: string;
  likes: Record<string, 1 | -1>;
  plan: PlanEntry[];
  pantry: string[];
  custom: Meal[];
  log: LogEntry[];
  photos: Record<string, PhotoInfo>;
  admin: boolean;
  adminConfigured: boolean;
  store: string;
  testing: { on: boolean; note: string };
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

export const setLike = (mealId: string, value: 1 | 0 | -1) => send<{ ok: true }>('likes', 'PUT', { mealId, value });
export const setSlot = (date: string, slot: MealType, mealId: string | null, opts: { force?: boolean; weekStart?: string } = {}) =>
  send<{ ok: true }>('plan', 'PUT', { date, slot, mealId, ...opts });
export const fillWeek = (start: string) => send<{ added: number }>('plan', 'POST', { action: 'fill', start }).then((b) => b.added);

export const adminStatus = () => fetch('/api/admin', { cache: 'no-store' }).then(json<{ configured: boolean; admin: boolean }>);
export const adminAction = (body: { action: 'setup' | 'login' | 'logout' | 'change'; password?: string; current?: string; next?: string }) =>
  send<{ ok: true }>('admin', 'POST', body);

export interface Candidate { title: string; thumb: string; page: string; license: string; credit: string }
export const searchPhotos = (q: string) => fetch(url(`photos/search?q=${encodeURIComponent(q)}`)).then(json<{ candidates: Candidate[] }>).then((b) => b.candidates);
export const choosePhoto = (mealId: string, c: Candidate) => send<{ ok: true }>(`photos/${encodeURIComponent(mealId)}`, 'POST', c);
export const autoPhotos = () => send<{ added: number; missing: string[] }>('photos/auto', 'POST');
export async function uploadPhoto(mealId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return fetch(url(`photos/${encodeURIComponent(mealId)}`), { method: 'POST', body: form }).then(json<{ ok: true }>);
}
export interface ChatReply { reply: string; recipes: Array<Omit<Meal, 'id'> & { note?: string }>; dropped: string[]; model: string }
export const askChat = (messages: Array<{ role: 'user' | 'assistant'; content: string }>, grandma: boolean) => send<ChatReply>('chat', 'POST', { messages, grandma });
export async function dictate(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', audio, audio.type.includes('webm') ? 'speech.webm' : 'speech.m4a');
  return fetch(url('dictate'), { method: 'POST', body: form }).then(json<{ text: string }>).then((b) => b.text);
}
export type FeedbackKind = 'good' | 'confusing' | 'wrong' | 'idea';
export interface FeedbackItem { id: string; profileId: string; kind: FeedbackKind; text: string; path: string; mode: string; device: string; build: string; createdAt: string; doneAt: string | null }
export const sendFeedback = (kind: FeedbackKind, text: string, path: string, mode: string) => send<{ id: string }>('feedback', 'POST', { kind, text, path, mode });
export const listFeedback = () => fetch(url('feedback'), { cache: 'no-store' }).then(json<{ feedback: FeedbackItem[] }>).then((b) => b.feedback);
export const markFeedback = (id: string, done: boolean) => send<{ ok: true }>('feedback', 'PATCH', { id, done });
export const setTesting = (change: { testing?: boolean; testingNote?: string }) => send<{ ok: true }>('settings', 'PUT', change);
export const setStore = (store: string) => send<{ ok: true; store: string }>('settings', 'PUT', { store });
export const photoUrl = (mealId: string, info?: PhotoInfo) => (info ? `/api/photos/${encodeURIComponent(mealId)}?v=${encodeURIComponent(info.v)}` : null);
export const setPantry = (foodId: string, on: boolean) => send<{ ok: true }>('pantry', 'PUT', { foodId, on });
export const logMeal = (mealId: string) => send<{ entry: LogEntry }>('log', 'POST', { mealId }).then((b) => b.entry);
export const unlog = (id: string) => send<{ ok: true }>(`log?id=${encodeURIComponent(id)}`, 'DELETE');
export const addMeal = (type: MealType, items: Item[], extra: { name?: string; steps?: string[]; minutes?: number | null; note?: string; source?: 'built' | 'fixed' | 'chat' } = {}) =>
  send<{ meal: Meal }>('meals', 'POST', { type, items, ...extra }).then((b) => b.meal);
export const deleteMeal = (id: string) => send<{ ok: true }>(`meals/${encodeURIComponent(id)}`, 'DELETE');
