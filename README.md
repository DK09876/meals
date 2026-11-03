# Meals

Meal ideas for someone on a diabetes and heart-healthy plan, checked against
her limits before they are shown. Built for my grandma: under 35 g of carbs a
meal, every carb paired with a protein or fat, low sodium, cholesterol under
200 mg a day and a few egg yolks a week. Runs on a Raspberry Pi on a private
tailnet, as a home-screen app on the family's iPhones.

**These are guidelines from her care team's handouts, not medical advice.**
Saturated fat follows her handout: no more than 5% of the day's calories,
counted across the day like cholesterol. The snack carb limit, sodium per meal
and her daily calorie target (which turns that 5% into grams) are guesses
until her dietitian confirms them; the app labels them so.

## What it does

**Grandma's view** (the default, big type, three tabs):

- **My week** - seven days of breakfast, lunch, dinner and a snack, with
  photos. *Fill my week* plans every empty slot so each day stays within her
  cholesterol and saturated fat and any seven days within her egg yolks.
  *I ate it*, then 👍 (a favourite, suggested more) or 👎 (never suggested again).
- **Recipes** - a photo grid: *For you* first, favourites, search. A recipe
  can be read, added to her week (each day marked fits or not, with meals
  that do fit offered instead) or marked eaten. *Make it fit* offers small
  swaps - less rice, egg whites for a whole egg - each checked again.
- **Ask** - ask for ideas in her own words, typed or spoken. Recipes come
  from a free language model but every number is the app's own: each one is
  added up from the food table, fixed with the smallest swap or left out if
  it breaks a limit. Speech is turned into text on the Pi (whisper.cpp).

**Admin** (the family, behind a password checked on the server): her limits,
the grocery list (this week or next, minus what's at home, each item a link
that searches Instacart at your store; share or copy the list), the at-home
list, recipe photos, building plates, and what she ate.

Every number is added up from a fixed food table: `lib/foods.ts` plus
`lib/foods-usda.json`, built from USDA FoodData Central by
`scripts/usda-foods.mjs`, in her handouts' serving sizes. Each built-in meal
is tested against her plan (`lib/catalog.test.ts`). Photos come from
Wikimedia Commons (credited) or the family, and stay on the Pi.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, SQLite through
`node-sqlite3-wasm` (the native addon segfaults on the Pi). Same shape as
LifeOS, MTG Tracker and Gains on the same Pi. There is no account: a profile
is a person being cooked for, picked once per phone. It is separation, not a
login - the tailnet is the security boundary.

```
npm install
npm run dev          # http://localhost:3000
npm test             # vitest; the backup test needs the sqlite3 CLI
npx tsc --noEmit && npm run lint && npm run build
```

`MEALS_DB_PATH` sets the database (default `data/meals.db`).
`node scripts/profile.cjs list|add|rename` manages profiles - stop the
service first, since two processes writing the WASM SQLite file is unsafe.

## On the Pi

Lives in `~/development/meals`, as systemd unit `meals` on 127.0.0.1:3003,
published by its own Tailscale node at `https://meals.<tailnet>.ts.net`.
Unit files are in `deploy/`.

### The Tailscale node can only reach this app

A userspace `tailscaled` passes any connection to its 100.x address on to the
Pi's localhost, whatever the port - so anyone the node is shared with could
reach SSH and the other apps. This node is different:

- it runs as its own system user, `ts-meals`, with no privileges;
- `deploy/meals-guard.nft`, loaded before it starts, rejects that user's
  connections to anything on the Pi except port 3003 (and DNS).

### First install

```
sudo useradd --system --no-create-home --shell /usr/sbin/nologin ts-meals
git clone https://github.com/DK09876/meals ~/development/meals && cd ~/development/meals
npm ci && npx next build
sudo cp deploy/meals*.service deploy/*.timer deploy/tailscaled-meals.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meals tailscaled-meals meals-backup.timer
sudo tailscale --socket=/run/tailscale-meals/tailscaled.sock up --hostname=meals
sudo tailscale --socket=/run/tailscale-meals/tailscaled.sock serve --bg 3003
```

Check the guard from another tailnet device: `nc -z <meals 100.x> 443` and
`3003` connect; `22`, `3000`, `3001`, `3002` are refused.

**Ask** needs a free model key in `.env` next to `package.json`
(`chmod 600`): `GROQ_API_KEY` (tried first, GPT-OSS 120B) and/or
`GEMINI_API_KEY` (Flash-Lite). Without either, Ask says it is not set up.

**Voice typing** needs whisper.cpp's server on 127.0.0.1:8792:

```
sudo apt-get install -y cmake ffmpeg
git clone --depth 1 https://github.com/ggml-org/whisper.cpp ~/whisper.cpp && cd ~/whisper.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j4 --target whisper-server
sh ./models/download-ggml-model.sh base.en
sudo cp ~/development/meals/deploy/whisper.service /etc/systemd/system/ && sudo systemctl enable --now whisper
```

### Deploy

```
bash scripts/backup.sh --force
git fetch && git reset --hard origin/main
npm ci && npx next build
sudo systemctl restart meals
```

Open phones reload themselves onto the new build.

### Backups

`meals-backup.timer` runs `scripts/backup.sh --verify` nightly at 03:50:
a `sqlite3 .backup` snapshot, gzipped, into `~/backups/meals/`, skipped when
nothing changed, newest 30 kept.

## License

MIT
