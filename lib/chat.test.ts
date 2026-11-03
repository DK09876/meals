import { afterEach, describe, expect, it, vi } from 'vitest';

import { ask, ChatUnavailable, configuredModels, systemPrompt, vet, type Model, type PromptContext } from './chat';
import { DEFAULT_RULES, evaluate } from './rules';

const ctx: PromptContext = { rules: DEFAULT_RULES, pantry: ['okra'], favourites: ['Lentil & spinach soup'], notForMe: [], grandma: true };
const fake = (id: string, answer: unknown | Error): Model => ({ id, call: vi.fn(async () => { if (answer instanceof Error) throw answer; return answer; }) });

const dal = { name: 'Moong dal with okra', type: 'lunch', minutes: 30, items: [{ food: 'mungbeans', servings: 1 }, { food: 'okra', servings: 2 }, { food: 'oliveoil', servings: 1 }], steps: ['Cook the dal.', 'Add okra.'] };

afterEach(() => vi.unstubAllGlobals());

describe('systemPrompt', () => {
  it('states her limits and lists the foods by id', () => {
    const p = systemPrompt(ctx);
    expect(p).toContain('at most 35 g per meal, 15 g per snack');
    expect(p).toContain('8.9 g a day');
    expect(p).toContain('mungbeans: Mung beans (moong dal), cooked - 1 serving = ½ cup cooked');
    expect(p).toContain('At home now: okra');
    expect(p).toContain('say "you"');
  });
});

describe('vet', () => {
  it('keeps a recipe that fits, with amounts written from the food table', () => {
    const { kept } = vet([dal], DEFAULT_RULES);
    expect(kept[0].items.map((i) => i.label)).toEqual(['½ cup cooked mung beans (moong dal)', '1 cup cooked okra (bhindi)', '1 tsp olive or canola oil']);
    expect(kept[0].note).toBeUndefined();
  });

  it('fixes one over the carb limit and says how', () => {
    const heavy = { ...dal, items: [...dal.items, { food: 'roti', servings: 1 }] }; // 19 + 10 + 20 = 49 g
    const { kept } = vet([heavy], DEFAULT_RULES);
    expect(kept[0].note).toMatch(/^Changed to fit the plan: /);
    expect(evaluate(kept[0].items, 'lunch', DEFAULT_RULES).fitsAnyDay).toBe(true);
  });

  it('drops recipes with foods it does not know, rather than guess their numbers', () => {
    const { kept, dropped } = vet([{ ...dal, name: 'Paneer tikka', items: [{ food: 'paneer', servings: 1 }] }], DEFAULT_RULES);
    expect(kept).toEqual([]);
    expect(dropped).toEqual(['Paneer tikka']);
  });

  it('rounds odd servings to quarters and merges repeats', () => {
    const { kept } = vet([{ ...dal, items: [{ food: 'okra', servings: 0.3 }, { food: 'okra', servings: 1 }, { food: 'tofu', servings: 1 }] }], DEFAULT_RULES);
    expect(kept[0].items[0]).toMatchObject({ food: 'okra', servings: 1.25 });
  });
});

describe('ask', () => {
  it('uses the first model that answers', async () => {
    const a = fake('a', new Error('busy'));
    const b = fake('b', { reply: 'Try this dal.', recipes: [dal] });
    const answer = await ask([{ role: 'user', content: 'something with okra' }], ctx, [a, b]);
    expect(answer).toMatchObject({ reply: 'Try this dal.', model: 'b', dropped: [] });
    expect(answer.recipes).toHaveLength(1);
  });

  it('says plainly when every model is busy', async () => {
    await expect(ask([{ role: 'user', content: 'hi' }], ctx, [fake('a', new Error('x'))])).rejects.toThrow(ChatUnavailable);
    await expect(ask([{ role: 'user', content: 'hi' }], ctx, [])).rejects.toThrow(/not set up/);
  });
});

describe('providers', () => {
  it('sends Groq a strict JSON-schema request, and falls back to Gemini when Groq is busy', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      if (String(url).includes('groq')) return new Response('busy', { status: 503 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: 'Here you go.', recipes: [dal] }) }] } }] });
    });
    const models = configuredModels({ GROQ_API_KEY: 'g', GEMINI_API_KEY: 'm' } as unknown as NodeJS.ProcessEnv, fetcher as unknown as typeof fetch);
    const answer = await ask([{ role: 'user', content: 'okra' }], ctx, models);
    expect(answer.model).toBe('gemini-3.5-flash-lite');
    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(calls[0].body).toMatchObject({ model: 'openai/gpt-oss-120b', response_format: { type: 'json_schema', json_schema: { strict: true } } });
    expect(calls[1].url).toContain('gemini-3.5-flash-lite:generateContent');
  });

  it('has no models without keys', () => {
    expect(configuredModels({} as NodeJS.ProcessEnv)).toEqual([]);
  });
});
