/**
 * The food table every number in the app is added up from.
 *
 * One row per food, in the serving sizes her handouts use ("½ cup cooked",
 * "6 almonds"), with the nutrition for one serving. Values are typical ones
 * from USDA FoodData Central, rounded, for the plain no-salt-added version of
 * each food - that is what the recipes ask for.
 *
 * Non-starchy vegetables are the exception: they are counted the way her
 * diabetes handout counts them, 5 g of carbs per cup raw or ½ cup cooked,
 * whatever the vegetable. That is more than most of them really have, which
 * errs on the safe side and matches what she was taught.
 *
 * Nothing here comes from a model. Meals are lists of these ids, and the
 * rules in rules.ts only ever add these numbers up.
 */

export type FoodGroup = 'veg' | 'protein' | 'starch' | 'fruit' | 'milk' | 'fat' | 'extra';

export interface Food {
  id: string;
  name: string;
  /** One serving, as her handouts would say it. */
  serving: string;
  group: FoodGroup;
  carbs: number;
  protein: number;
  fat: number;
  satFat: number;
  /** mg */
  sodium: number;
  /** mg */
  cholesterol: number;
  /** Whole egg yolks in one serving - her handout limits these per week. */
  yolks?: number;
}

type Row = Omit<Food, 'id'>;

const veg = (name: string, serving: string, sodium: number): Row => ({
  name, serving, group: 'veg', carbs: 5, protein: 1.5, fat: 0.2, satFat: 0, sodium, cholesterol: 0,
});

const ROWS: Record<string, Row> = {
  // Grains, beans and starchy vegetables
  oats: { name: 'Oatmeal', serving: '½ cup cooked', group: 'starch', carbs: 14, protein: 3, fat: 1.8, satFat: 0.3, sodium: 2, cholesterol: 0 },
  wwbread: { name: 'Whole-wheat bread', serving: '1 slice', group: 'starch', carbs: 12, protein: 4, fat: 1, satFat: 0.2, sodium: 140, cholesterol: 0 },
  tortilla: { name: 'Whole-wheat tortilla', serving: '1 small (6 in)', group: 'starch', carbs: 15, protein: 3, fat: 2, satFat: 0.5, sodium: 200, cholesterol: 0 },
  brownrice: { name: 'Brown rice', serving: '⅓ cup cooked', group: 'starch', carbs: 15, protein: 1.7, fat: 0.6, satFat: 0.1, sodium: 3, cholesterol: 0 },
  quinoa: { name: 'Quinoa', serving: '⅓ cup cooked', group: 'starch', carbs: 13, protein: 2.7, fat: 1.2, satFat: 0.1, sodium: 4, cholesterol: 0 },
  wwpasta: { name: 'Whole-wheat pasta', serving: '⅓ cup cooked', group: 'starch', carbs: 13, protein: 2.5, fat: 0.4, satFat: 0.1, sodium: 2, cholesterol: 0 },
  sweetpot: { name: 'Sweet potato', serving: '½ cup baked', group: 'starch', carbs: 20, protein: 2, fat: 0.2, satFat: 0, sodium: 40, cholesterol: 0 },
  lentils: { name: 'Lentils', serving: '½ cup cooked', group: 'starch', carbs: 20, protein: 9, fat: 0.4, satFat: 0.1, sodium: 2, cholesterol: 0 },
  blackbeans: { name: 'Black beans, low-sodium', serving: '½ cup', group: 'starch', carbs: 20, protein: 7, fat: 0.5, satFat: 0.1, sodium: 140, cholesterol: 0 },
  chickpeas: { name: 'Chickpeas, low-sodium', serving: '½ cup', group: 'starch', carbs: 22, protein: 7, fat: 2, satFat: 0.2, sodium: 120, cholesterol: 0 },

  // Fruit
  blueberries: { name: 'Blueberries', serving: '¾ cup', group: 'fruit', carbs: 16, protein: 0.8, fat: 0.4, satFat: 0, sodium: 1, cholesterol: 0 },
  strawberries: { name: 'Strawberries', serving: '1 cup sliced', group: 'fruit', carbs: 12, protein: 1, fat: 0.5, satFat: 0, sodium: 2, cholesterol: 0 },
  apple: { name: 'Apple', serving: '1 small', group: 'fruit', carbs: 15, protein: 0.3, fat: 0.2, satFat: 0, sodium: 1, cholesterol: 0 },
  pear: { name: 'Pear', serving: '½ medium', group: 'fruit', carbs: 14, protein: 0.3, fat: 0.1, satFat: 0, sodium: 1, cholesterol: 0 },
  orange: { name: 'Orange', serving: '1 small', group: 'fruit', carbs: 15, protein: 1.2, fat: 0.2, satFat: 0, sodium: 0, cholesterol: 0 },

  // Milk
  milk: { name: 'Skim milk', serving: '1 cup', group: 'milk', carbs: 12, protein: 8, fat: 0.2, satFat: 0.1, sodium: 105, cholesterol: 5 },
  soymilk: { name: 'Soy milk, unsweetened', serving: '1 cup', group: 'milk', carbs: 4, protein: 7, fat: 4, satFat: 0.5, sodium: 90, cholesterol: 0 },

  // Protein - lean picks only, as her cholesterol handout asks
  greekyog: { name: 'Greek yogurt, plain nonfat', serving: '¾ cup', group: 'protein', carbs: 6, protein: 17, fat: 0.7, satFat: 0.2, sodium: 61, cholesterol: 9 },
  egg: { name: 'Egg, whole', serving: '1 large', group: 'protein', carbs: 0.4, protein: 6.3, fat: 4.8, satFat: 1.6, sodium: 71, cholesterol: 186, yolks: 1 },
  eggwhite: { name: 'Egg whites', serving: '2 whites', group: 'protein', carbs: 0.4, protein: 7.2, fat: 0.1, satFat: 0, sodium: 110, cholesterol: 0 },
  chicken: { name: 'Chicken breast, skinless', serving: '3 oz cooked', group: 'protein', carbs: 0, protein: 26, fat: 3, satFat: 0.9, sodium: 63, cholesterol: 73 },
  salmon: { name: 'Salmon', serving: '3 oz baked', group: 'protein', carbs: 0, protein: 22, fat: 7, satFat: 1.2, sodium: 52, cholesterol: 54 },
  cod: { name: 'Cod or tilapia', serving: '3 oz baked', group: 'protein', carbs: 0, protein: 20, fat: 1, satFat: 0.2, sodium: 65, cholesterol: 50 },
  turkey: { name: 'Turkey breast, roasted', serving: '3 oz (not deli)', group: 'protein', carbs: 0, protein: 26, fat: 1.5, satFat: 0.4, sodium: 55, cholesterol: 60 },
  tofu: { name: 'Tofu, firm', serving: '½ cup', group: 'protein', carbs: 2, protein: 10, fat: 5.5, satFat: 0.8, sodium: 9, cholesterol: 0 },
  cottage: { name: 'Cottage cheese, low-fat, no salt added', serving: '½ cup', group: 'protein', carbs: 4, protein: 14, fat: 1, satFat: 0.6, sodium: 30, cholesterol: 5 },

  // Non-starchy vegetables, counted as her handout counts them
  broccoli: veg('Broccoli', '½ cup cooked', 30),
  spinach: veg('Spinach', '1 cup raw', 24),
  greens: veg('Salad greens', '1 cup', 10),
  tomato: veg('Tomato', '½ cup', 5),
  cucumber: veg('Cucumber', '1 cup sliced', 2),
  peppers: veg('Bell peppers', '½ cup cooked', 3),
  carrots: veg('Carrots', '½ cup', 45),
  greenbeans: veg('Green beans', '½ cup cooked', 5),
  zucchini: veg('Zucchini', '½ cup cooked', 5),
  cauliflower: veg('Cauliflower', '½ cup cooked', 15),
  mushrooms: veg('Mushrooms', '½ cup cooked', 5),
  bokchoy: veg('Bok choy', '½ cup cooked', 50),
  onion: veg('Onion', '½ cup cooked', 3),
  asparagus: veg('Asparagus', '½ cup cooked', 13),
  cabbage: veg('Cabbage', '½ cup cooked', 6),

  // Healthy fats - unsaturated, unsalted
  almonds: { name: 'Almonds, unsalted', serving: '6 almonds', group: 'fat', carbs: 1.5, protein: 1.8, fat: 3.6, satFat: 0.3, sodium: 0, cholesterol: 0 },
  walnuts: { name: 'Walnuts', serving: '4 halves', group: 'fat', carbs: 1, protein: 1.2, fat: 5.2, satFat: 0.5, sodium: 0, cholesterol: 0 },
  pb: { name: 'Peanut butter, no salt', serving: '1 Tbsp', group: 'fat', carbs: 3, protein: 4, fat: 8, satFat: 1.3, sodium: 3, cholesterol: 0 },
  avocado: { name: 'Avocado', serving: '2 Tbsp', group: 'fat', carbs: 2.6, protein: 0.6, fat: 4.4, satFat: 0.6, sodium: 2, cholesterol: 0 },
  oliveoil: { name: 'Olive or canola oil', serving: '1 tsp', group: 'fat', carbs: 0, protein: 0, fat: 4.5, satFat: 0.6, sodium: 0, cholesterol: 0 },
  hummus: { name: 'Hummus', serving: '2 Tbsp', group: 'fat', carbs: 4, protein: 2, fat: 5, satFat: 0.7, sodium: 115, cholesterol: 0 },
  seeds: { name: 'Pumpkin or sunflower seeds, unsalted', serving: '1 Tbsp', group: 'fat', carbs: 1.5, protein: 2.5, fat: 4.5, satFat: 0.8, sodium: 1, cholesterol: 0 },

  // Not a food group, but it carries sodium, so recipes still count it
  lssoy: { name: 'Low-sodium soy sauce', serving: '1 tsp', group: 'extra', carbs: 0.3, protein: 0.3, fat: 0, satFat: 0, sodium: 190, cholesterol: 0 },
};

export const FOODS: Record<string, Food> = Object.fromEntries(
  Object.entries(ROWS).map(([id, row]) => [id, { id, ...row }]),
);

export const isFood = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(FOODS, id);

/** The groups in the order they are offered, with the handout's way of putting each. */
export const GROUPS: Array<{ id: Exclude<FoodGroup, 'extra'>; label: string; hint: string; color: string }> = [
  { id: 'veg', label: 'Non-starchy veggies', hint: 'Eat freely · 5 g carbs a serving', color: 'var(--plate-veg)' },
  { id: 'protein', label: 'Protein', hint: 'Lean picks only', color: 'var(--plate-protein)' },
  { id: 'starch', label: 'Grains, beans & starchy veg', hint: '13–22 g carbs a serving', color: 'var(--plate-starch)' },
  { id: 'fruit', label: 'Fruit', hint: '12–16 g carbs a serving', color: 'var(--plate-fruit)' },
  { id: 'milk', label: 'Milk', hint: '4–12 g carbs a cup', color: 'var(--plate-milk)' },
  { id: 'fat', label: 'Healthy fats', hint: 'Pair these with carbs', color: 'var(--plate-fat)' },
];

export const foodsIn = (group: FoodGroup): Food[] => Object.values(FOODS).filter((f) => f.group === group);

/** "Oatmeal" from "Oatmeal, cooked"-style names, for short lists. */
export const shortName = (food: Food): string => food.name.split(',')[0];
