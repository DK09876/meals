import { afterEach, describe, expect, it, vi } from 'vitest';

import { ask, ChatUnavailable, configuredModels, resolveFood, systemPrompt, vet, type Model, type PromptContext } from './chat';
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

describe('resolveFood', () => {
  it('takes ids, and names a model is likely to write instead', () => {
    expect(['oats', 'Oatmeal', 'oatmeal', 'Blueberries', 'blueberry', 'Almonds', 'moong dal', 'Bhindi', 'Greek yogurt', 'chicken breast', 'roti', 'chapati'].map(resolveFood))
      .toEqual(['oats', 'oats', 'oats', 'blueberries', 'blueberries', 'almonds', 'mungbeans', 'okra', 'greekyog', 'chicken', 'roti', 'roti']);
  });

  it('leaves what it cannot be sure of unknown', () => {
    expect(['paneer', 'bacon', 'butter', ''].map(resolveFood)).toEqual([null, null, null, null]);
  });

  it('keeps a recipe the model wrote with names and capitals', () => {
    const { kept } = vet([{ name: 'Warm oatmeal', type: 'Breakfast', minutes: 10, items: [{ food: 'Oatmeal', servings: 1 }, { food: 'blueberries', servings: '1' }, { food: 'Almonds', servings: 1 }], steps: [] }], DEFAULT_RULES);
    expect(kept.map((r) => [r.type, r.items.map((i) => i.food)])).toEqual([['breakfast', ['oats', 'blueberries', 'almonds']]]);
  });
});

describe('seasonings a model lists as ingredients', () => {
  it('moves them to the steps instead of leaving the recipe out', () => {
    const { kept, dropped } = vet([{ ...dal, items: [...dal.items, { food: 'garlic', servings: 1 }, { food: 'Lemon juice', servings: 0.5 }, { food: 'ground cumin', servings: 0.25 }] }], DEFAULT_RULES);
    expect(dropped).toEqual([]);
    expect(kept[0].items.map((i) => i.food)).toEqual(['mungbeans', 'okra', 'oliveoil']);
    expect(kept[0].steps.at(-1)).toBe('Season with garlic, lemon juice, ground cumin.');
  });

  it('does not repeat a seasoning the steps already mention', () => {
    const { kept } = vet([{ ...dal, steps: ['Fry the garlic.'], items: [...dal.items, { food: 'garlic', servings: 1 }] }], DEFAULT_RULES);
    expect(kept[0].steps).toEqual(['Fry the garlic.']);
  });

  it('leaves salt out and says so', () => {
    const { kept } = vet([{ ...dal, items: [...dal.items, { food: 'salt', servings: 0.25 }] }], DEFAULT_RULES);
    expect(kept[0].items.map((i) => i.food)).not.toContain('salt');
    expect(kept[0].steps.at(-1)).toBe('No added salt - her plan is low sodium.');
  });

  it('still leaves out real foods it cannot check', () => {
    expect(vet([{ ...dal, name: 'Paneer dal', items: [...dal.items, { food: 'paneer', servings: 1 }] }], DEFAULT_RULES).dropped).toEqual(['Paneer dal']);
    expect(vet([{ ...dal, name: 'Ghee dal', items: [...dal.items, { food: 'ghee', servings: 1 }] }], DEFAULT_RULES).dropped).toEqual(['Ghee dal']);
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
