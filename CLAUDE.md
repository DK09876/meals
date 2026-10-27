# Meals - notes for working on this repo

A health aid for a real person. Every number she sees must be computed from
`lib/foods.ts` by `lib/rules.ts` and be checkable; never let a model or a
guess supply nutrition values.

- Rules live in `lib/rules.ts` (with where each comes from). A check that
  depends on what she already ate is `situational`; a built meal may be saved
  if it fails only those.
- Adding or changing a built-in meal: `lib/catalog.test.ts` must still pass -
  every catalog meal fits the default rules.
- Foods: one serving in her handouts' words; non-starchy veg always 5 g carbs.
  Foods her cholesterol handout says to limit (bacon, butter, deli meats,
  full-fat cheese) are left out of the table on purpose.
- Data: `lib/db.ts` (CREATE IF NOT EXISTS on open, no migrations folder; add
  columns with a PRAGMA table_info check). Routes in `app/api/**` take
  `?profile=` and refuse unknown profiles.
- Her limits carry `rulesUpdatedAt`; PATCH /api/rules needs the base version
  and returns 409 on a stale copy. Keep that check for any new shared setting.
- Client writes go through `components/DataProvider.tsx`: optimistic, rolled
  back on failure. Polling pauses while a write is in flight.
- Tests must never call paid APIs; stub them. Before calling a UI change done,
  click through a production build in Playwright (WebKit, iPhone 14 Pro).
- Phone rules: tap targets at least 44 px, inputs 16 px or more, safe-area
  padding, status shown with an icon and words, never colour alone.
- main is PR-only: branch, `gh pr create`, wait for CI, merge.
