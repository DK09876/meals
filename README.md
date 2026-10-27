# Meals

Meal ideas for someone on a diabetes and heart-healthy plan, checked against
her limits before they are shown. Built for my grandma: under 35 g of carbs a
meal, every carb paired with a protein or fat, low sodium, cholesterol under
200 mg a day and a few egg yolks a week. Runs on a Raspberry Pi on a private
tailnet, as a home-screen app on the family's iPhones.

**These are guidelines from her care team's handouts, not medical advice.**
The snack, sodium and saturated-fat limits are guesses until her dietitian
confirms them; the app labels them so.

## What it does

- **Ideas** - one meal at a time for breakfast, lunch, dinner or a snack,
  showing carbs against her limit, her handout's plate (half veggies, a quarter
  grains, a quarter protein) and every check. Only meals that fit right now are
  offered - including today's cholesterol and this week's egg yolks. "Use
  what's at home" puts meals needing the fewest groceries first.
- **She ate this** - logs a meal (with Undo), which feeds those day and week checks.
- **Build a plate** - add foods group by group and watch the checks; a meal
  can only be saved once it fits.
- **At home** - a checklist of what is in the kitchen.
- **Saved & history** - bookmarked meals, and what she ate by day.
- **Her plan** - the limits, where each came from, and steppers to change
  them. Two phones changing them at once cannot overwrite each other: a change
  made from a stale copy is refused (409) and the phone shows what is set.

Every number is added up from a fixed food table (`lib/foods.ts`, USDA values
in her handouts' serving sizes); nothing comes from a model. Each built-in meal
is tested against her plan (`lib/catalog.test.ts`).

Later: scan a grocery receipt into the at-home list, use up items when a meal
is cooked, a weekly plan with a shopping list, and meal-time reminders.

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
sudo cp deploy/*.service deploy/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now meals tailscaled-meals meals-backup.timer
sudo tailscale --socket=/run/tailscale-meals/tailscaled.sock up --hostname=meals
sudo tailscale --socket=/run/tailscale-meals/tailscaled.sock serve --bg 3003
```

Check the guard from another tailnet device: `nc -z <meals 100.x> 443` and
`3003` connect; `22`, `3000`, `3001`, `3002` are refused.

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
