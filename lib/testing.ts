/**
 * The testing phase: while it is on, every screen says the app is being
 * tested and what is being tried right now, and anyone - Grandma too - can
 * say what works and what does not. Admins turn it off when it is done.
 * On until someone turns it off, so a new install asks for feedback first.
 */

import { getSetting, setSetting } from './db';

export const DEFAULT_TESTING_NOTE = 'the week planner, recipe photos, asking for ideas by voice, and the grocery list';

export interface TestingState { on: boolean; note: string }

export function testingState(): TestingState {
  return { on: getSetting('testing.on') !== 'off', note: getSetting('testing.note') ?? DEFAULT_TESTING_NOTE };
}

export function setTesting(change: Partial<TestingState>): TestingState {
  if (change.on !== undefined) setSetting('testing.on', change.on ? 'on' : 'off');
  if (change.note !== undefined) setSetting('testing.note', change.note.trim() || null);
  return testingState();
}
