#!/usr/bin/env node
/**
 * Builds lib/foods-usda.json: the extra foods chat can use, with nutrition
 * taken straight from USDA FoodData Central (SR Legacy, public domain).
 *
 *   curl -O https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
 *   unzip FoodData_Central_sr_legacy_food_json_2018-04.zip
 *   node scripts/usda-foods.mjs FoodData_Central_sr_legacy_food_json_2018-04.json
 *
 * Each row: [id, fdcId, name, serving in her handouts' words, grams in that
 * serving, group]. Grams come from the portion weights USDA gives for the
 * same food. Non-starchy vegetables keep USDA's sodium, protein and fat but
 * are counted at 5 g of carbs a serving, as her handout counts them.
 *
 * Left out on purpose: foods her cholesterol handout says to limit (bacon,
 * sausage, butter, full-fat cheese, organ meats), salted versions where an
 * unsalted one exists, and anything fried.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROWS = [
  // grains, beans, starchy vegetables
  ['whiterice', 168878, 'White rice', '⅓ cup cooked', 52.7, 'starch'],
  ['mungbeans', 174257, 'Mung beans (moong dal), cooked', '½ cup cooked', 101, 'starch'],
  ['kidneybeans', 173740, 'Kidney beans (rajma), cooked', '½ cup cooked', 88.5, 'starch'],
  ['blackeyedpeas', 173759, 'Black-eyed peas, cooked', '½ cup cooked', 85.5, 'starch'],
  ['splitpeas', 172429, 'Split peas, cooked', '½ cup cooked', 98, 'starch'],
  ['roti', 174075, 'Whole-wheat roti (chapati)', '1 roti (6 in)', 43, 'starch'],
  ['barley', 170285, 'Barley, cooked', '⅓ cup cooked', 52.3, 'starch'],
  ['bulgur', 170287, 'Bulgur, cooked', '½ cup cooked', 91, 'starch'],
  ['couscous', 169700, 'Couscous, cooked', '⅓ cup cooked', 52.3, 'starch'],
  ['buckwheat', 170686, 'Buckwheat, cooked', '½ cup cooked', 84, 'starch'],
  ['potato', 170093, 'Potato, baked with skin', '¼ large (3 oz)', 85, 'starch'],
  ['corn', 169999, 'Corn, cooked', '½ cup', 74.5, 'starch'],
  ['greenpeas', 170017, 'Green peas, cooked', '½ cup', 80, 'starch'],
  ['butternut', 169296, 'Butternut squash, baked', '1 cup cubes', 205, 'starch'],
  ['corntortilla', 173241, 'Corn tortilla, no salt added', '1 (6 in)', 26, 'starch'],
  ['pumpkin', 168450, 'Pumpkin, canned, no salt', '1 cup', 245, 'starch'],
  // fruit
  ['banana', 173944, 'Banana', '½ medium', 59, 'fruit'],
  ['grapes', 174683, 'Grapes', '17 small (3 oz)', 85, 'fruit'],
  ['peach', 169928, 'Peach', '1 medium', 150, 'fruit'],
  ['mango', 169910, 'Mango', '½ cup', 82.5, 'fruit'],
  ['kiwi', 168153, 'Kiwi', '1 (2 in)', 69, 'fruit'],
  ['cantaloupe', 169092, 'Cantaloupe', '1 cup cubes', 156, 'fruit'],
  ['watermelon', 167765, 'Watermelon', '1¼ cups diced', 190, 'fruit'],
  ['raspberries', 167755, 'Raspberries', '1 cup', 123, 'fruit'],
  ['blackberries', 173946, 'Blackberries', '¾ cup', 108, 'fruit'],
  ['cherries', 171719, 'Cherries', '12 cherries', 82, 'fruit'],
  ['pineapple', 169124, 'Pineapple', '¾ cup', 124, 'fruit'],
  ['papaya', 169926, 'Papaya', '1 cup cubes', 145, 'fruit'],
  ['plums', 169949, 'Plums', '2 small', 132, 'fruit'],
  // milk and yogurt
  ['milk1', 170872, 'Low-fat milk (1%)', '1 cup', 244, 'milk'],
  ['yogurtlf', 170886, 'Yogurt, plain low-fat', '¾ cup', 184, 'milk'],
  ['kefir', 170904, 'Kefir, plain low-fat', '1 cup', 243, 'milk'],
  // lean protein
  ['shrimp', 175180, 'Shrimp, cooked', '3 oz', 85, 'protein'],
  ['tuna', 171986, 'Tuna in water, no salt added', '3 oz', 85, 'protein'],
  ['pork', 168250, 'Pork tenderloin, lean', '3 oz cooked', 85, 'protein'],
  ['sirloin', 174054, 'Beef sirloin, lean', '3 oz cooked', 85, 'protein'],
  ['groundturkey', 172851, 'Ground turkey (93% lean)', '3 oz cooked', 85, 'protein'],
  ['chickenthigh', 172388, 'Chicken thigh, skinless', '3 oz cooked', 85, 'protein'],
  ['tilapia', 175177, 'Tilapia', '3 oz baked', 85, 'protein'],
  ['edamame', 168411, 'Edamame', '½ cup', 77.5, 'protein'],
  ['tempeh', 174272, 'Tempeh', '½ cup', 83, 'protein'],
  ['ricotta', 171248, 'Ricotta, part-skim', '¼ cup', 62, 'protein'],
  ['mozzarella', 170847, 'Mozzarella, part-skim', '1 oz', 28.35, 'protein'],
  // healthy fats
  ['sesameoil', 171016, 'Sesame oil', '1 tsp', 4.5, 'fat'],
  ['flaxseed', 169414, 'Flaxseed, ground', '1 Tbsp', 7, 'fat'],
  ['chia', 170554, 'Chia seeds', '1 Tbsp', 12, 'fat'],
  ['pistachios', 170185, 'Pistachios, unsalted', '16 nuts', 11.2, 'fat'],
  ['cashews', 170571, 'Cashews, unsalted', '6 nuts', 9, 'fat'],
  ['pecans', 170182, 'Pecans', '4 halves', 6, 'fat'],
  ['olives', 169094, 'Black olives', '8 large', 35.2, 'fat'],
  // non-starchy vegetables (5 g carbs a serving, per her handout)
  ['okra', 169261, 'Okra (bhindi)', '½ cup cooked', 80, 'veg'],
  ['kale', 169238, 'Kale', '½ cup cooked', 59, 'veg'],
  ['collards', 170407, 'Collard greens', '½ cup cooked', 95, 'veg'],
  ['brussels', 169971, 'Brussels sprouts', '½ cup cooked', 78, 'veg'],
  ['eggplant', 169229, 'Eggplant (baingan)', '½ cup cooked', 49.5, 'veg'],
  ['beets', 169146, 'Beets', '½ cup cooked', 85, 'veg'],
  ['celery', 169988, 'Celery', '1 cup raw', 101, 'veg'],
  ['radish', 169276, 'Radishes', '1 cup raw', 116, 'veg'],
  ['artichoke', 168386, 'Artichoke hearts', '½ cup cooked', 84, 'veg'],
  ['cannedtomato', 170138, 'Canned tomatoes, no salt added', '½ cup', 120, 'veg'],
  ['bittergourd', 168394, 'Bitter gourd (karela)', '½ cup cooked', 62, 'veg'],
  ['spongegourd', 168415, 'Ridge or sponge gourd (turai)', '½ cup cooked', 89, 'veg'],
  ['turnip', 170058, 'Turnips', '½ cup cooked', 78, 'veg'],
  ['beansprouts', 169137, 'Mung bean sprouts', '½ cup cooked', 62, 'veg'],
  ['snowpeas', 170011, 'Snow peas', '½ cup cooked', 80, 'veg'],
];

const NUTRIENT = { carbs: '205', protein: '203', fat: '204', satFat: '606', sodium: '307', cholesterol: '601' };
const r1 = (n) => Math.round(n * 10) / 10;

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/usda-foods.mjs <FoodData_Central_sr_legacy_food_json_*.json>'); process.exit(1); }
const foods = new Map(JSON.parse(readFileSync(file, 'utf8')).SRLegacyFoods.map((f) => [f.fdcId, f]));

const out = {};
for (const [id, fdcId, name, serving, grams, group] of ROWS) {
  const f = foods.get(fdcId);
  if (!f) throw new Error(`fdcId ${fdcId} (${id}) not found`);
  const per100 = Object.fromEntries(f.foodNutrients.filter((n) => n.nutrient).map((n) => [n.nutrient.number, n.amount ?? 0]));
  const v = (k) => ((per100[NUTRIENT[k]] ?? 0) * grams) / 100;
  out[id] = {
    name, serving, group, fdcId, usda: f.description,
    carbs: group === 'veg' ? 5 : r1(v('carbs')),
    protein: r1(v('protein')), fat: r1(v('fat')), satFat: r1(v('satFat')),
    sodium: Math.round(v('sodium')), cholesterol: Math.round(v('cholesterol')),
  };
}
writeFileSync(join(import.meta.dirname, '..', 'lib', 'foods-usda.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${Object.keys(out).length} foods`);
