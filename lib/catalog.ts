/**
 * The meals the app ships with: simple home cooking that fits her plan as
 * written. Every one is checked against the default rules in catalog.test.ts,
 * so a typo in a portion cannot put an over-limit meal in front of her.
 *
 * Ids are stable slugs - saved meals and history point at them.
 */

import type { Item, MealType } from './rules';

export interface Meal {
  id: string;
  type: MealType;
  name: string;
  minutes: number | null;
  items: Item[];
  steps: string[];
  note?: string;
  /** Built by the family on the Build screen. */
  custom?: boolean;
}

const i = (food: string, servings: number, label: string): Item => ({ food, servings, label });

export const CATALOG: Meal[] = [
  // --- breakfast ---------------------------------------------------------
  {
    id: 'berry-oatmeal', type: 'breakfast', name: 'Berry oatmeal with walnuts', minutes: 10,
    items: [i('oats', 1, '½ cup cooked oatmeal, no salt'), i('blueberries', 0.67, '½ cup blueberries'), i('walnuts', 1, '4 walnut halves, chopped'), i('greekyog', 0.67, '½ cup plain nonfat Greek yogurt')],
    steps: ['Cook the oats in water. Skip the salt.', 'Top with blueberries and walnuts.', 'Spoon the yogurt on top or on the side. A pinch of cinnamon helps.'],
  },
  {
    id: 'veggie-omelet', type: 'breakfast', name: 'Veggie omelet with toast', minutes: 15,
    items: [i('egg', 1, '1 whole egg'), i('eggwhite', 1, '2 egg whites'), i('spinach', 1, '1 cup spinach'), i('peppers', 1, '½ cup diced peppers'), i('wwbread', 1, '1 slice whole-wheat toast'), i('oliveoil', 1, '1 tsp olive oil for the pan')],
    steps: ['Soften the peppers in the oil, then wilt the spinach.', 'Whisk the egg and whites, pour over and fold.', 'Serve with dry toast. No butter.'],
    note: 'Uses 1 egg yolk, which counts toward her weekly limit.',
  },
  {
    id: 'yogurt-berry-bowl', type: 'breakfast', name: 'Greek yogurt berry bowl', minutes: 5,
    items: [i('greekyog', 1, '¾ cup plain nonfat Greek yogurt'), i('strawberries', 1.25, '1¼ cups sliced strawberries'), i('almonds', 1, '6 almonds, chopped')],
    steps: ['Spoon the yogurt into a bowl.', 'Top with strawberries and almonds.'],
  },
  {
    id: 'pb-toast-apple', type: 'breakfast', name: 'Peanut butter toast & apple', minutes: 5,
    items: [i('wwbread', 1, '1 slice whole-wheat toast'), i('pb', 1, '1 Tbsp natural peanut butter'), i('apple', 0.5, '½ small apple, sliced'), i('milk', 0.5, '½ cup skim milk')],
    steps: ['Toast the bread and spread the peanut butter.', 'Serve with apple slices and milk.'],
  },
  {
    id: 'cottage-pear', type: 'breakfast', name: 'Cottage cheese with pear & walnuts', minutes: 5,
    items: [i('cottage', 1, '½ cup low-fat, no-salt-added cottage cheese'), i('pear', 1, '½ pear, sliced'), i('walnuts', 1, '4 walnut halves')],
    steps: ['Spoon the cottage cheese into a bowl.', 'Top with pear slices and walnuts. Cinnamon is a good extra.'],
    note: 'Regular cottage cheese has about 400 mg of sodium in ½ cup. Look for "no salt added".',
  },

  // --- lunch ---------------------------------------------------------------
  {
    id: 'turkey-avocado-wrap', type: 'lunch', name: 'Turkey & avocado wrap', minutes: 10,
    items: [i('tortilla', 1, '1 small whole-wheat tortilla'), i('turkey', 0.67, '2 oz roasted turkey breast'), i('avocado', 1, '2 Tbsp mashed avocado'), i('greens', 1, '1 cup lettuce'), i('tomato', 1, '½ cup sliced tomato'), i('cucumber', 1, '1 cup cucumber on the side')],
    steps: ['Spread avocado on the tortilla.', 'Layer turkey, lettuce and tomato, then roll.', 'Serve cucumber slices on the side.'],
    note: 'Use home-roasted turkey. Deli turkey can add 500 mg of sodium.',
  },
  {
    id: 'lentil-spinach-soup', type: 'lunch', name: 'Lentil & spinach soup', minutes: 30,
    items: [i('lentils', 1, '½ cup cooked lentils'), i('carrots', 1, '½ cup diced carrots'), i('spinach', 1, '1 cup spinach'), i('oliveoil', 1, '1 tsp olive oil'), i('greekyog', 0.25, '3 Tbsp Greek yogurt on top')],
    steps: ['Soften the carrots in the oil.', 'Add lentils and no-salt-added broth. Simmer 20 minutes.', 'Stir in the spinach. Season with lemon, cumin and pepper instead of salt.', 'Top with a spoon of yogurt.'],
  },
  {
    id: 'chicken-quinoa-salad', type: 'lunch', name: 'Chicken quinoa salad', minutes: 15,
    items: [i('chicken', 1, '3 oz grilled chicken'), i('greens', 2, '2 cups mixed greens'), i('tomato', 1, '½ cup cherry tomatoes'), i('quinoa', 1, '⅓ cup cooked quinoa'), i('oliveoil', 1, '1 tsp olive oil + vinegar')],
    steps: ['Slice the chicken.', 'Toss greens, tomatoes and quinoa with oil and vinegar.', 'Lay the chicken on top.'],
  },
  {
    id: 'chicken-veg-pasta-soup', type: 'lunch', name: 'Chicken vegetable soup', minutes: 30,
    items: [i('chicken', 0.67, '2 oz shredded chicken'), i('carrots', 1, '½ cup carrots'), i('zucchini', 1, '½ cup zucchini'), i('onion', 1, '½ cup onion'), i('wwpasta', 1, '⅓ cup whole-wheat pasta'), i('oliveoil', 1, '1 tsp olive oil')],
    steps: ['Soften onion and carrots in the oil.', 'Add no-salt-added broth and the pasta. Simmer 10 minutes.', 'Add zucchini and chicken for the last 5 minutes. Season with herbs and pepper.'],
  },

  // --- dinner --------------------------------------------------------------
  {
    id: 'salmon-rice-broccoli', type: 'dinner', name: 'Baked salmon, rice & broccoli', minutes: 25,
    items: [i('salmon', 1, '3 oz baked salmon'), i('brownrice', 1.5, '½ cup brown rice'), i('broccoli', 1, '½ cup steamed broccoli'), i('greens', 1, '1 cup side salad'), i('oliveoil', 1, '1 tsp olive oil dressing')],
    steps: ['Bake the salmon at 400°F for 12–15 minutes with lemon and dill.', 'Steam the broccoli.', 'Serve with the rice and a small salad.'],
    note: 'From her handout menu, with the rice cut from ⅔ to ½ cup. ⅔ cup is 30 g of carbs on its own.',
  },
  {
    id: 'chicken-stir-fry', type: 'dinner', name: 'Chicken & veggie stir-fry', minutes: 20,
    items: [i('chicken', 1, '3 oz chicken strips'), i('peppers', 1, '½ cup peppers'), i('bokchoy', 1, '½ cup bok choy'), i('mushrooms', 1, '½ cup mushrooms'), i('quinoa', 1, '⅓ cup quinoa'), i('oliveoil', 1, '1 tsp canola oil'), i('lssoy', 1, '1 tsp low-sodium soy sauce')],
    steps: ['Stir-fry the chicken in the oil until cooked.', 'Add the vegetables for 3–4 minutes.', 'Finish with soy sauce, ginger and garlic. Serve over quinoa.'],
  },
  {
    id: 'sheet-pan-chicken', type: 'dinner', name: 'Sheet-pan chicken & sweet potato', minutes: 35,
    items: [i('chicken', 1, '3 oz chicken breast'), i('sweetpot', 1, '½ cup sweet potato cubes'), i('zucchini', 1, '½ cup zucchini'), i('cauliflower', 1, '½ cup cauliflower'), i('oliveoil', 1, '1 tsp olive oil')],
    steps: ['Toss everything with the oil, paprika and garlic powder.', 'Roast at 425°F for 25 minutes.'],
  },
  {
    id: 'black-bean-bowl', type: 'dinner', name: 'Black bean veggie bowl', minutes: 15,
    items: [i('blackbeans', 1, '½ cup low-sodium black beans'), i('peppers', 1, '½ cup peppers'), i('onion', 1, '½ cup onion'), i('avocado', 1, '2 Tbsp avocado'), i('greekyog', 0.25, '3 Tbsp Greek yogurt, as sour cream')],
    steps: ['Rinse the beans.', 'Cook the peppers and onion with cumin.', 'Top with beans, avocado and yogurt.'],
  },
  {
    id: 'tofu-green-beans', type: 'dinner', name: 'Tofu & green bean stir-fry', minutes: 20,
    items: [i('tofu', 1, '½ cup firm tofu, cubed'), i('greenbeans', 1, '½ cup green beans'), i('mushrooms', 1, '½ cup mushrooms'), i('brownrice', 1, '⅓ cup brown rice'), i('oliveoil', 1, '1 tsp canola oil'), i('lssoy', 1, '1 tsp low-sodium soy sauce')],
    steps: ['Brown the tofu in the oil.', 'Add green beans and mushrooms for 4 minutes.', 'Finish with soy sauce and garlic. Serve over rice.'],
  },
  {
    id: 'lemon-cod-asparagus', type: 'dinner', name: 'Lemon cod with asparagus', minutes: 20,
    items: [i('cod', 1, '3 oz cod or tilapia'), i('asparagus', 2, '1 cup asparagus'), i('quinoa', 1.5, '½ cup quinoa'), i('oliveoil', 1, '1 tsp olive oil')],
    steps: ['Lay fish and asparagus on a tray, brush with the oil.', 'Add lemon slices and pepper. Bake at 400°F for 12 minutes.', 'Serve with the quinoa.'],
  },
  {
    id: 'turkey-pasta', type: 'dinner', name: 'Turkey & tomato pasta', minutes: 25,
    items: [i('turkey', 1, '3 oz roasted turkey, diced'), i('wwpasta', 1.5, '½ cup whole-wheat pasta'), i('tomato', 1, '½ cup chopped tomato'), i('zucchini', 1, '½ cup zucchini'), i('oliveoil', 1, '1 tsp olive oil')],
    steps: ['Cook the pasta without salt.', 'Soften tomato and zucchini in the oil with garlic and basil.', 'Stir in turkey and pasta.'],
    note: 'Jarred pasta sauce can carry 400+ mg of sodium; fresh tomatoes keep it low.',
  },

  // --- snacks: always a carb with a protein or fat -------------------------
  {
    id: 'apple-pb', type: 'snack', name: 'Apple & peanut butter', minutes: 2,
    items: [i('apple', 0.5, '½ small apple'), i('pb', 1, '1 Tbsp natural peanut butter')], steps: [],
  },
  {
    id: 'veggies-hummus', type: 'snack', name: 'Veggies & hummus', minutes: 5,
    items: [i('carrots', 1, '½ cup carrot sticks'), i('cucumber', 1, '1 cup cucumber'), i('hummus', 1, '2 Tbsp hummus')], steps: [],
  },
  {
    id: 'strawberries-almonds', type: 'snack', name: 'Strawberries & almonds', minutes: 2,
    items: [i('strawberries', 1, '1 cup strawberries'), i('almonds', 1, '6 almonds')], steps: [],
  },
  {
    id: 'yogurt-walnuts', type: 'snack', name: 'Yogurt & walnuts', minutes: 2,
    items: [i('greekyog', 1, '¾ cup plain nonfat Greek yogurt'), i('walnuts', 1, '4 walnut halves')], steps: [],
  },
  {
    id: 'pear-walnuts', type: 'snack', name: 'Pear & walnuts', minutes: 2,
    items: [i('pear', 1, '½ pear'), i('walnuts', 1, '4 walnut halves')], steps: [],
  },
];

export const catalogMeal = (id: string): Meal | undefined => CATALOG.find((m) => m.id === id);
