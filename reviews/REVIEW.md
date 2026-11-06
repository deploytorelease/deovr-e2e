# REVIEW.md: deovr-e2e, "search, open, play, pause, resume"

> **A snapshot of the review of 2026-11-05.** The code has changed since:
> the specs moved to `tests/ui/`, the thresholds moved to `THRESHOLDS` in
> `src/playback-checks.ts`, and the exploration notes (`EXPLORATION.md`) were
> removed. File names and line numbers below refer to the code at the time of
> the review. All findings are resolved: see "Resolution" at the end.

<!--
Produced by the qa-reviewer agent (Claude Code) on 2026-11-05. Saved from its
final message; local absolute paths were replaced by repository names and a
few explanatory sentences condensed. No finding was added, removed or reworded in substance.
-->

<!--
Author's verification of the findings (not part of the agent's review):
- F1, F3, F4, F5, F6, F7, F8, F9, F10: confirmed by reading the code.
- F2: half confirmed. The step 8 absence check runs before any click and cannot
  fail (agreed). The doubt about `role="dialog"` is refuted by the exploration:
  after the click on play on /wgp2ar the paywall matched `[role=dialog],dialog`.
  The agent's probe opened /wgp2ar without the click, so the dialog could not
  appear.
-->


## Scope
- Repository under review: deovr-e2e (this repository). Nothing is committed yet (`git status --short` lists every file as `??`), so the whole repository is the change.
- Reviewed: tests/search-and-play.spec.ts, tests/data/video.ts, src/media-probe.ts, src/time.ts, src/pages/home.page.ts, src/pages/search-results.page.ts, src/pages/video.page.ts, playwright.config.ts, package.json, SCENARIO.md, README.md, EXPLORATION.md. AI_WORKFLOW.md was checked only for whether its factual claims match the code.
- Rules applied: my-qa/ (the framework repository of the author) AGENTS.md sections 3-5, and docs/conventions/assertions.md, locators.md and stability.md, as far as they fit a standalone repo that tests a live third-party site.
- Rules not applied: `qa.id(...)`, fixtures/cleanup, `pollUntil` from `shared`, the ESLint `qa/*` rules and `check:forbidden-patterns`. None of them exist in this repo, and the site keeps no data the test creates.
- No file was changed.

## Verified facts
- `npm run typecheck` (`tsc --noEmit`) exits 0.
- `npx playwright test --project=desktop-chrome --project=mobile-safari --reporter=line` printed `2 passed (34.7s)` and exited 0. A second copy of the output went to a scratchpad folder.
- The configuration has `retries: 0`, `workers: 1`, `timeout: 90_000` and `expect.timeout: 15_000` (playwright.config.ts:12-16).
- Grep of src/ and tests/ finds no `waitForTimeout`, `force:`, `.nth(` or XPath. It finds one `.catch` (src/pages/video.page.ts:82) and one `.first()` (src/pages/search-results.page.ts:21). The `.first()` has a written reason: "first" is the business rule.
- The media probe returns the promise of the original `play` unchanged and keeps `this` (src/media-probe.ts:34-38). It does not pass arguments on: `originalPlay.call(this)`.
- `mediaState` and `sampleCurrentTime` read the *last* element in `window.__qaMedia` (`started.at(-1)`, src/media-probe.ts:47 and :74). The `started` count is collected but no test ever checks it.
- Live probe (desktop Chromium, script in the scratchpad, not in the repo): the page keeps the same `window` from the search results to `/y2yde2`, so it is client-side navigation and `__qaMedia` survives it.
- Same probe: after the start click, exactly one element was captured: `inDom: false`, `paused: false`, `duration: 249.194`, source `cdn-vr.deovr.com/.../h264/140261_1080p.mp4`, `currentTime` 5.99 about 6 s later. Hovering the second result card started no media element.
- Same probe, desktop, during playback: `[class*="videoSectionPlayer"] [class*="currentTime"]`, `[class*="_timestamp_"]` and `[class*="videoInfoSection"]` each match exactly 1 element. The search returned 32 `main article` cards; the first card's text starts with `04:09` and the expected title, then `Arni Hrolfsson`.
- Earlier failure artifacts of the author are kept in test-results/ (13:35 and 13:36, `retain-on-failure`). For mobile-chrome and mobile-safari, error-context.md shows `expect(locator).toBeVisible()` failing on `[class*="mobilePlayControls"] button:has(use[href$="#play"])` with "element(s) not found", while the player shows `00:18 / 04:09`. This matches the claimed mutation (pause skipped, step 11 fails), and it fails at spec line 113, the UI check.
- A direct `goto` of the premium video `/wgp2ar` showed no `firstPlayBtn`. No `Unlock DeoVR Premium` text and no matching `getByRole('dialog')` appeared, so the paywall dialog could not be reproduced.

## Assumptions
- Most likely the test-results/ artifacts come from the mutation run described in README.md:99 and AI_WORKFLOW.md:48. The file names do not say so.
- When no `actionTimeout` is set, `locator.evaluate` in `#controlsShown` waits for the element without its own limit. Inside `expect.poll` this can show up as a poll timeout and not as a locator error. Not reproduced.
- A detached `<video>` keeps playing after its React owner unmounts unless it is paused. This is general browser behaviour and was not observed on DeoVR.

## Files and symbols
- tests/search-and-play.spec.ts: the threshold constants (lines 10-14), `expectPlaying` (24-37), steps 1-12 (39-134).
- src/media-probe.ts: `installMediaProbe`, `mediaState`, `sampleCurrentTime`.
- src/pages/video.page.ts: `NO_ACCESSIBLE_NAME`, `PlayerComponent` (`#controlsShown`, `revealControls`, `start`, `pause`, `play`, `shownTime`), `VideoPage.premiumDialog`.
- src/pages/search-results.page.ts: `firstCard`, `readCard`, `openCard`.
- src/pages/home.page.ts: `signInButton` (split for mobile), `searchBox`, `openSearch`.
- playwright.config.ts, package.json.
- SCENARIO.md (steps 8, 9, 12), EXPLORATION.md (lines 18, 20, 63), README.md (lines 79, 98-99), AI_WORKFLOW.md (lines 36, 48, 55).

## Evidence
- Test run: `Running 2 tests using 1 worker`, then `[1/2] [desktop-chrome] ...`, `[2/2] [mobile-safari] ...`, then `2 passed (34.7s)`, `EXIT 0`.
- Typecheck: `> tsc --noEmit`, exit code 0.
- Probe output: `"spa": true`, `"media": [{ "paused": false, "t": 5.992151, "d": 249.194, "inDom": false }]`, `"ct": 1, "ts": 1, "vi": 1`, `"afterHover": []`.
- Premium probe output: `startCount 0`, `dialogRole 0 text 0`.
- test-results/*-mobile-chrome/error-context.md and *-mobile-safari/error-context.md: `Locator: locator('[class*="videoSectionPlayer"]').locator('[class*="mobilePlayControls"] button:has(use[href$="#play"])') ... Error: element(s) not found`.

## Findings

**Blocker.** No blocker findings.

**Major**

- **F1. The thresholds do not match SCENARIO.md, but the code says they do.**
  - Severity: major. Classification: TEST_BUG.
  - Where: tests/search-and-play.spec.ts:9-11 and 24-37 (`expectPlaying`), line 92.
  - Rule: AGENTS.md §3 ("Never change an expected result ... A changed expectation is a decision of a human"); assertions.md "What a test proves".
  - Growth window: SCENARIO steps 9 and 12 say `currentTime` grows by at least 1 s **within 3 s**. The code uses `GROWTH_WINDOW = 5_000`, and the comment on line 9 still says "Thresholds of SCENARIO.md".
  - Start budget: SCENARIO step 9 says **within 15 s**. The code allows `toBeVisible({ timeout: 15_000 })` (line 92), then a 15 s poll on `paused` (lines 25-30), then a 5 s growth poll. That is up to 35 s.
  - Growth check in step 9: `expectPlaying(0)` checks the absolute value `currentTime > 1`, not growth from the first observed value. Playback that stalls at 1.2 s passes this check. Only the integer-second UI poll in step 10 would catch it.
  - Effect: playback that starts in 20-30 s, or grows 1 s in 4-5 s, passes, although the spec says it must fail.

**Minor**

- **F2. The premium-dialog absence checks are not proven.**
  - Severity: minor. Classification: INSUFFICIENT_EVIDENCE.
  - Where: tests/search-and-play.spec.ts:87 and :93; `VideoPage.premiumDialog` (video.page.ts:146).
  - Rule: assertions.md "The proof for an absence" and "The negative control".
  - EXPLORATION.md:20 says the dialog appears only after a click on play. So the step 8 check (`toHaveCount(0)` before any click) cannot fail.
  - Nothing shows that the paywall has `role="dialog"`. EXPLORATION gives no role, and the live probe of `/wgp2ar` could not show the dialog (0 matches). If the role is different, both checks always pass.
  - In practice a premium video is caught by step 6 (fixed test data) and by the pause-button timeout in step 9. But the step 9 error would not mention the paywall, so EXPLORATION.md:63 ("a paywall has to fail with a clear message") is not met.

- **F3. "Continues from the paused position" is checked by one read right after the click.**
  - Severity: minor. Classification: TEST_BUG.
  - Where: tests/search-and-play.spec.ts:127-133.
  - Rule: assertions.md "What a test proves"; locators.md (`waitForTimeout` row: "Hides a race condition").
  - `resumed` is read once, as soon as `pauseButton` is visible. If the player reset its time to 0 a moment later, that read would miss it.
  - The later `expectPlaying(pausedAt)` only needs `currentTime > pausedAt + 1` within 5 s. `pausedAt` is about 3-6 s here. So a restart from 0 can still reach `pausedAt + 1` in the 5 s window when `pausedAt` is below about 4 s.
  - A stronger check would be a minimum over a sampled window, or a check that the value never drops below `pausedAt - 0.25`.

- **F4. `#controlsShown` hides locator errors.**
  - Severity: minor. Classification: TEST_BUG.
  - Where: src/pages/video.page.ts:71-83 (`.catch(() => false)`) and the `expect.poll` in `revealControls` (101-103).
  - Rule: AGENTS.md §4 ("a try/catch that swallows a locator error", forbidden without a written justification; none is given); AGENTS.md §5 / stability.md ("keeps the last error", "a diagnostic message").
  - A strict-mode violation on `[class*="currentTime"]`, a detached element or an evaluate error all become `false`. The run then ends with "The controls of the player must appear", and the real cause is lost.

- **F5. Step 6 reads the first card only once.**
  - Severity: minor. Classification: TEST_BUG.
  - Where: tests/search-and-play.spec.ts:70-77; `SearchResultsPage.readCard` (search-results.page.ts:24-31).
  - Rule: stability.md ("the wait for a concrete loading state of the UI"); assertions.md (failure messages that point to the real cause).
  - `innerText()` runs one time, right after `firstCard` is visible. If the list is still rendering or stale, `toEqual` fails with "The search ranking changed: update tests/data/video.ts", which is the wrong diagnosis.
  - Web-first `toHaveText` on the title, channel and duration locators would retry and keep the right message.

- **F6. The step 7 URL check is too broad.**
  - Severity: minor. Classification: TEST_BUG.
  - Where: tests/search-and-play.spec.ts:81.
  - Rule: AGENTS.md §4 / locators.md ("a broader locator ... hides a product change").
  - `/^https:\/\/deovr\.com\/[a-z0-9]{6}$/` also matches `/photos`. EXPLORATION.md:18 states this exact pitfall.
  - The test data is a fixed video (`/y2yde2`), but tests/data/video.ts does not store its id. Step 8 limits the damage.

- **F7. The probe does not identify the player's element.**
  - Severity: minor. Classification: TEST_BUG (latent; no false result today).
  - Where: src/media-probe.ts:47 and :74 (`at(-1)`); `MediaState.started` is never asserted.
  - Rule: assertions.md "What a test proves".
  - `window` survives the SPA navigation, and `play` is wrapped in every frame. Any element started later (a related-video preview, an ad, a second element after a quality change) becomes "the media" for steps 9, 11 and 12, with no error.
  - Today the live probe saw exactly 1 element. A check that `started === 1`, or that the source is the player's CDN or the duration is 249 s, in every step would close this.

- **F8. The negative control covers only the UI check of step 11.**
  - Severity: minor. Classification: INSUFFICIENT_EVIDENCE.
  - Where: test-results/*/error-context.md; README.md:99.
  - Rule: assertions.md "The negative control".
  - The kept mutation failure stops at `expect(player.playButton).toBeVisible()` (spec line 113). Nothing shows that the media-level checks (`paused` poll, drift check, resume checks) can fail.
  - A second mutation is needed, for example a pause through the UI icon only, or a resume that seeks to 0.

- **F9. The docs say the probe passes on the same arguments; it passes none.**
  - Severity: minor. Classification: TEST_BUG (docs).
  - Where: src/media-probe.ts:10-11 and :38; SCENARIO.md "How the video plays is proven"; README.md:65.
  - `play()` takes no parameters, so behaviour is not affected, but the claim is wrong.

- **F10. Small mismatches between the docs and the code.**
  - Severity: minor. Classification: TEST_BUG (docs).
  - README.md:79 says only "the start button and the time of the player" use CSS-module class parts; `NO_ACCESSIBLE_NAME` also has `videoInfoSection`, `videoSectionPlayer`, `_timestamp_` and `mobilePlayControls`.
  - AI_WORKFLOW.md:55 mentions "the 10 runs of `mobile-safari`", but README.md:98 reports 5 per project.
  - AI_WORKFLOW.md:36 mentions "13 steps", but SCENARIO has 12.
  - The AI_WORKFLOW.md tables and lists at lines 16-26 are still empty template sections.

## Risks
- Mobile `start()` taps the `#play` button without `revealControls` and without a readiness signal. AI_WORKFLOW.md:55 documents one emulated-iPhone run where the first tap started nothing. That failure would show up as an unexplained 15 s timeout on `pauseButton` (spec:92 has no message).
- Several assertions have no message: spec:92, 113 and 128 (`pauseButton` / `playButton` visible), spec:98 (duration text) and spec:114 (the `paused` poll).
- `revealControls` checks first and presses later. If the controls fade between the check and the tap on a phone, the tap only shows the controls, and pause or play does nothing. Low-probability flake.
- The 90 s test timeout is less than the sum of the possible waits. A slow site can end as "Test timeout of 90000ms exceeded" and not as a step failure.
- On phones, `toBeVisible` on the pause and play buttons passes even at `opacity: 0`. "The button changes" rests only on the swap of the SVG icon id.
- CSS-module class parts and SVG sprite ids break when the build changes. Documented as the last option.
- Live data: the search ranking, the video itself and ad iframes can change or slow down the run.

## Commands
- `npm run typecheck`
- `npx playwright test --project=desktop-chrome --project=mobile-safari --reporter=line --output=<scratchpad>/pw-out`
- `grep -rn "waitForTimeout\|force:\|\.nth(\|xpath\|catch" src tests`
- `node <scratchpad>/probe/probe.mjs`: a read-only Chromium probe of the search page and `/y2yde2`.
- `node <scratchpad>/probe/premium.mjs`: a read-only probe of `/wgp2ar`.
- `head -60 test-results/*/error-context.md`

## What was actually run
- Typecheck: passed (exit 0).
- Playwright on desktop-chrome and mobile-safari, run once each: 2 passed in 34.7 s, exit 0.
- Two read-only probe scripts on desktop Chromium against the live site.

## What was not verified
- The desktop-safari and mobile-chrome projects were not run by this review. The claim of 20/20 runs is not backed by a kept report and was not reproduced.
- The mutation check was not re-run; only the kept failure artifacts were read.
- Whether the premium paywall has `role="dialog"`: the paywall could not be shown in the probe.
- The locator counts on the phone layout, and the counts in the paused state.
- Whether `locator.evaluate` inside `#controlsShown` can block until the test timeout.
- The behaviour on a slow network and on real devices.

## Confidence
- SUPPORTED

## Resolution (by the author, after the review)

- F1 fixed: the start budget is 15 s counted from the click and the growth window 3 s, as in SCENARIO.md; growth is measured relative to the first sample of the window. Today all thresholds are in `THRESHOLDS` of `src/playback-checks.ts`.
- F2 fixed: the absence check moved from step 8 to step 9, after the click, with the message "The video opened the premium paywall: it is not free any more". The doubt about `role="dialog"` is refuted (see the note at the top).
- F3 fixed: step 12 samples the whole 3 s window and requires that no sample drops below the paused position. Mutation M2 (restart from 0 after 0.5 s) fails there.
- F4 fixed: `.catch(() => false)` removed; only a missing element counts as "not shown", every other error is raised.
- F5 fixed: step 6 uses retrying `toHaveText` on the title, the channel and the duration of the card.
- F6 fixed: the path `/y2yde2` is test data; step 7 checks the exact URL.
- F7 fixed: `playerMedia` requires exactly one started element whose source is `https://cdn-vr.deovr.com/`, in steps 9–12; the probe reads the first element.
- F8 fixed: two more mutations (pause not pressed with the UI check removed; restart from 0) fail on the media checks, on the desktop and on the phone.
- F9 fixed: the docs say "calls the original `play` on the same element and returns its promise unchanged".
- F10 fixed: the locators without a name or a test id are listed in `NO_TEST_ID` of `src/pages/video.page.ts`, with the reason; the docs were aligned with the code.
- Risks: every assertion has a message; the test timeout is 180 s; the phone race (controls fading between the check and the tap) is removed by waiting for the hide and pressing right after a reveal. A new bug found while fixing it: the reveal tap at (40, 40) pressed `Play in VR` on a phone.
- Rare stalls of the live video (the time standing still for a few seconds) are given a grace of 10 s (`stallGraceMs`): a recovered stall passes with a warning in the report, a player that does not recover fails. Proven by freezing the video for 8 s (passes with the warning) and for good (fails).
