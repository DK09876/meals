/**
 * "Ask": recipe ideas from a language model, kept honest by the app.
 *
 * The model is shown her limits and the food table, and asked for recipes
 * made only of those foods in multiples of their servings. It never supplies
 * a number she sees: every recipe it returns is added up here from the food
 * table and checked against her limits. One that breaks a limit is fixed
 * with the smallest swap that makes it fit (lib/swaps.ts) and says so, or is
 * left out. Amounts are written out from the table, not in the model's words,
 * so a recipe cannot say "1 cup rice" while counting a third of one.
 *
 * Free models, tried in order, once each, with a short time limit - a busy
 * model means trying the next one, then saying plainly it is busy, never a
 * long wait. The model call is injected, so tests never reach a provider.
 */

import { FOODS } from './foods';
import { scaleServing } from './grocery';
import { evaluate, isMealType, limitsFor, mealTypeLabel, NOTHING_EATEN, satFatBudget, type Item, type MealType, type Rules } from './rules';
import { makeItFit } from './swaps';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DraftRecipe {
  name: string;
  type: MealType;
  minutes: number | null;
  items: Item[];
  steps: string[];
  /** Set when the app had to change the model's recipe to fit her plan. */
  note?: string;
}

export interface ChatAnswer {
  reply: string;
  recipes: DraftRecipe[];
  /** Recipes the model offered that could not be made to fit, by name. */
  dropped: string[];
  model: string;
}

export interface ModelRequest {
  system: string;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
}

/** One provider and model. Throws on any failure; returns the parsed JSON. */
export interface Model {
  id: string;
  call: (req: ModelRequest) => Promise<unknown>;
}

export class ChatUnavailable extends Error {}

export const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'recipes'],
  properties: {
    reply: { type: 'string' },
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'type', 'minutes', 'items', 'steps'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          minutes: { type: 'integer' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['food', 'servings'],
              properties: { food: { type: 'string' }, servings: { type: 'number' } },
            },
          },
          steps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export interface PromptContext {
  rules: Rules;
  pantry: string[];
  favourites: string[];
  notForMe: string[];
  /** "you" for Grandma, "she" when the family asks. */
  grandma: boolean;
}

export function systemPrompt(c: PromptContext): string {
  const r = c.rules;
  const foods = Object.values(FOODS)
    .map((f) => `${f.id}: ${f.name} - 1 serving = ${f.serving} (${f.carbs} g carbs)`)
    .join('\n');
  const who = c.grandma ? 'You are talking with her directly - say "you".' : 'You are talking with her family - say "she".';
  return `You help plan meals for an older woman with diabetes and high cholesterol. ${who}
Be warm, brief and plain: short sentences, no medical advice, no lists of numbers - the app shows the numbers.

Her plan (the app checks every recipe against it, so stay inside it):
- Carbs: at most ${limitsFor('breakfast', r).carbs} g per meal, ${r.carbSnack} g per snack.
- Every carb (grains, beans, fruit, milk) must come with a protein or a fat.
- Lunch and dinner: half the plate non-starchy vegetables.
- Low sodium: at most ${r.sodiumMeal} mg per meal. No added salt; season with herbs, spices, lemon, garlic, ginger, vinegar.
- Saturated fat at most ${satFatBudget(r)} g a day, cholesterol at most ${r.cholesterolDay} mg a day, at most ${r.yolksWeek} egg yolks a week.
- Never: fried food, bacon, sausage, deli meats, butter, full-fat cheese, cream, organ meats, sugary drinks, pastries.

Recipes may use ONLY these foods, by id, in servings of the size shown (servings can be 0.25, 0.5, 1, 1.5, 2...). Herbs, spices, lemon, garlic, ginger and vinegar can go in the steps without being listed.
${foods}

${c.pantry.length ? `At home now: ${c.pantry.join(', ')}. Prefer these when it makes sense.` : ''}
${c.favourites.length ? `Meals she likes: ${c.favourites.join(', ')}.` : ''}
${c.notForMe.length ? `Meals she did not like: ${c.notForMe.join(', ')}.` : ''}

Answer with JSON: "reply" is your short message. "recipes" holds 0 to 3 recipes when she asks for ideas (none for a simple question): name, type (breakfast, lunch, dinner or snack), minutes, items [{food: id, servings}], and 2 to 5 short steps. If she asks for something her plan does not allow, say so kindly and offer the closest thing that fits.`;
}

const roundQuarter = (n: number) => Math.round(n * 4) / 4;

/** One recipe from the model, made safe: known foods, sensible servings, amounts in the table's words. */
function clean(raw: unknown): Omit<DraftRecipe, 'note'> | null {
  const r = raw as { name?: unknown; type?: unknown; minutes?: unknown; items?: unknown; steps?: unknown };
  if (typeof r?.name !== 'string' || !r.name.trim() || !isMealType(r.type) || !Array.isArray(r.items) || !r.items.length) return null;
  const items: Item[] = [];
  for (const it of r.items as Array<{ food?: unknown; servings?: unknown }>) {
    if (typeof it?.food !== 'string' || !FOODS[it.food] || typeof it.servings !== 'number') return null;
    const servings = roundQuarter(Math.min(6, Math.max(0.25, it.servings)));
    const existing = items.find((x) => x.food === it.food);
    if (existing) existing.servings += servings;
    else items.push({ food: it.food, servings });
  }
  const steps = Array.isArray(r.steps) ? r.steps.filter((s): s is string => typeof s === 'string' && !!s.trim()).map((s) => s.trim().slice(0, 300)).slice(0, 8) : [];
  const minutes = typeof r.minutes === 'number' && r.minutes > 0 && r.minutes < 300 ? Math.round(r.minutes) : null;
  return { name: r.name.trim().slice(0, 60), type: r.type, minutes, items: items.map(withLabel), steps };
}

export const withLabel = (item: Item): Item => {
  const f = FOODS[item.food];
  return { food: item.food, servings: item.servings, label: `${scaleServing(f.serving, item.servings)} ${f.name.split(',')[0].toLowerCase()}` };
};

/** Checked against her plan as a recipe (any day); fixed if a small swap does it, else dropped. */
export function vet(recipes: unknown[], rules: Rules): { kept: DraftRecipe[]; dropped: string[] } {
  const kept: DraftRecipe[] = [];
  const dropped: string[] = [];
  for (const raw of recipes.slice(0, 3)) {
    const r = clean(raw);
    if (!r) {
      const name = (raw as { name?: unknown })?.name;
      if (typeof name === 'string') dropped.push(name);
      continue;
    }
    if (evaluate(r.items, r.type, rules, NOTHING_EATEN).fitsAnyDay) {
      kept.push(r);
      continue;
    }
    const [fix] = makeItFit(r.items, r.type, rules, NOTHING_EATEN, 1);
    if (fix) kept.push({ ...r, items: fix.items.map(withLabel), note: `Changed to fit the plan: ${fix.text.charAt(0).toLowerCase()}${fix.text.slice(1)}.` });
    else dropped.push(r.name);
  }
  return { kept, dropped };
}

export async function ask(messages: ChatMessage[], context: PromptContext, models: Model[]): Promise<ChatAnswer> {
  if (!models.length) throw new ChatUnavailable('Recipe chat is not set up on the Pi yet.');
  const req: ModelRequest = { system: systemPrompt(context), messages, schema: ANSWER_SCHEMA };
  for (const model of models) {
    let data: unknown;
    try {
      data = await model.call(req);
    } catch (e) {
      console.error(`chat: ${model.id} failed:`, e instanceof Error ? e.message : e);
      continue;
    }
    const answer = data as { reply?: unknown; recipes?: unknown };
    if (typeof answer?.reply !== 'string') continue;
    const { kept, dropped } = vet(Array.isArray(answer.recipes) ? answer.recipes : [], context.rules);
    return { reply: answer.reply.trim().slice(0, 1500), recipes: kept, dropped, model: model.id };
  }
  throw new ChatUnavailable('The recipe helper is busy right now. Try again in a minute.');
}

// --- providers ---------------------------------------------------------------

type Fetch = typeof fetch;
const TIMEOUT_MS = 25_000;

/** Groq's OpenAI-style API, as MTG Tracker uses it. */
export function groqModel(key: string, model = 'openai/gpt-oss-120b', fetcher: Fetch = fetch): Model {
  return {
    id: model,
    async call({ system, messages, schema }) {
      // MEALS_GROQ_URL points a local end-to-end check at a stand-in server.
      const res = await fetcher(process.env.MEALS_GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...messages],
          response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema } },
          reasoning_effort: 'low',
          temperature: 0.4,
          max_completion_tokens: 3000,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return JSON.parse(body.choices?.[0]?.message?.content ?? '');
    },
  };
}

/** Gemini's REST API, JSON out. */
export function geminiModel(key: string, model = 'gemini-3.5-flash-lite', fetcher: Fetch = fetch): Model {
  return {
    id: model,
    async call({ system, messages }) {
      const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const body = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return JSON.parse(body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '');
    },
  };
}

/** The models this Pi has keys for, best first. */
export function configuredModels(env: NodeJS.ProcessEnv = process.env, fetcher: Fetch = fetch): Model[] {
  const out: Model[] = [];
  if (env.GROQ_API_KEY) out.push(groqModel(env.GROQ_API_KEY, env.MEALS_GROQ_MODEL || undefined, fetcher));
  if (env.GEMINI_API_KEY) out.push(geminiModel(env.GEMINI_API_KEY, env.MEALS_GEMINI_MODEL || undefined, fetcher));
  return out;
}

export const typeWord = (t: MealType) => mealTypeLabel(t).toLowerCase();
