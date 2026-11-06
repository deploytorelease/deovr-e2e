# CLAUDE.md

E2E tests of the live site <https://deovr.com/>: Playwright + TypeScript,
Allure 3, Zod. Run: see [README.md](README.md). Steps and thresholds:
[SCENARIO.md](SCENARIO.md) is the source of truth.

## Workflow

1. Check the site before writing code; confirm every conclusion with a trace
   or a screenshot, not a guess.
2. Change SCENARIO.md first, then the code. `THRESHOLDS` in
   `src/playback-checks.ts` must match it.
3. Prove a new check with a mutation: break the behaviour, see the test fail in
   the intended step with a clear message, revert.
4. Done means: `npm run typecheck` passes and the test passes on
   `desktop-chrome` and `mobile-chrome` (player changes: all four browsers).

## Rules

- No `waitForTimeout`, no `sleep`, no retries. Wait for a condition.
- Every assertion has a message that names the cause (`allurerc.mjs` groups
  failures by it).
- One `test.step` per step of SCENARIO.md.
- Locators: role + name → `data-testid` → icon or CSS-module class part, in
  `NO_TEST_ID` of `src/pages/video.page.ts`.
- No hard-coded prices, discounts or currencies: check the arithmetic.
- Never loosen a check to get a green run.
- Known site bugs: exceptions by id in `tests/data/known-issues.ts`, never
  `test.fail` (it hides any other failure of the test).
- Live site, read only: no login, no checkout, no comments, API `GET` only,
  one worker.

## Pitfalls of the site

- No `<video>` in the DOM: use `installMediaProbe` + `playerMedia`.
- Not every search result is free: use `tests/data/video.ts`, never "any result".
- Controls fade out but stay visible to Playwright: read `data-ui-hidden`.
- Phone: a tap toggles the controls; never tap the top left corner (`Play in VR`).
- `Play` is not unique (`Play in VR`): use `exact: true`.
- Assert the exact video path: `/photos` also has six letters.
- The paywall is two nested dialogs: locate it by its heading.
- A playback stall gets `stallGraceMs`; do not raise the budgets instead.
- Open pages with `openPage` (`src/pages/navigation.ts`), not `page.goto`: it
  waits for `load` (handlers attached) but not for a hanging ad request.
