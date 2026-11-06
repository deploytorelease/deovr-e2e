# How I worked with AI

## Tools

Claude Code (desktop) with its built-in browser. Plus agents from my own
framework my-qa: one writes the tests, another one (qa-reviewer) reviews
them after. Tests are Playwright + TypeScript, the report is Allure.

## How I worked

I set the task and what counts as done, the AI looked at the site and wrote
the code. I didn't take anything on trust: every conclusion I checked with a
run or a screenshot/trace. To make sure a test really catches something, I
broke the behaviour on purpose (for example, removed the click on pause) and
checked that the test fails on the right step. Stability I checked with 5
runs in a row, no retries.

## My original scenario

First I wrote the steps myself, the way I see them:

1. deovr.com page opens
2. user is not logged in
3. search field is on the page and visible
4. click the field
5. type Immersive Iceland
6. press enter
7. search results page opens
8. remember and click the first item in Search results
9. video page opens
10. compare that it's the same as in the search results
11. press play
12. make sure the video started and the time in the player matches the time
    on the search page and on the video page
13. pause, press play

Then I asked the AI to turn it into a proper test case with an expected
result for every step. What changed:

- "not logged in" became a precondition + a check that the header shows
  Sign In;
- "first result" stayed, but I fixed a specific video: the second result for
  this query is premium and opens a paywall;
- "time matches" got clearer: the duration matches (04:09), the current time
  has to grow;
- "pause, play" I split into two steps, each with its own expected result.

I didn't describe the whole player, only what this path needs. The other
player buttons are a separate test. The result is in [SCENARIO.md](SCENARIO.md).

## Key prompts

- **"Turn my scenario into a test case for an autotest"** + the steps above.
  The AI first went through all steps on the live site, then made the table.
- **"Check that the video really plays, not only that the button changed"**.
  Turned out the player has no video tag, it draws on a canvas. The AI found
  a way to get the real video element and read its time. I added a condition:
  take only the video from the player's CDN, so an ad can't pass for it.
- **"Add Safari and mobile browsers"**. On phones everything failed at first:
  different header, search hidden behind a button, pause didn't press. We
  sorted it out from the failure screenshots.
- **"Tests must not depend on current prices and discounts. Discount
  changed — the test doesn't fail, it checks that everything adds up. And
  add API tests"**. The API tests found a couple of real problems on the site:
  for example, three videos in the library have duration 0, and a premium
  video tells a visitor "full access: yes".
- **"Attach the video to the report only on failure"**. Checked: a failed test
  has the video, a passed one doesn't.

## What the AI did well

- Explored the site before writing code and found the pitfalls right away:
  premium videos in the results, a player without a video tag, buttons
  without names.
- Came up with a way to prove the video really plays.
- Good at analysing failures from screenshots and traces instead of guessing.
- Took all the routine: 5 environments, page objects, Allure, API.

## What I had to fix myself

- The AI sometimes made wrong conclusions. For example, it decided that on a
  phone the search shows a different video, but it just read the page before
  it loaded. It also wrote that the player has no data-testid — it does.
- There are no blind pauses (sleep) in the tests: a test waits for a specific
  condition ("the video time moved") and goes on as soon as it's true. But
  the reviewer agent found that the limits in the code didn't match the
  scenario: the test was ready to wait up to 35 s for the video to start,
  the scenario says 15. I brought it in line with the scenario.
- I didn't like the tap at a fixed point on mobile. Turned out on a phone
  that point hits the "Play in VR" button — that's where the flaky failures
  came from.
- Hard-coded prices I banned from the start.
- The test rarely failed because the video on the live site froze for a few
  seconds (a couple of times in Safari, once in Chrome, out of 100+ runs).
  The test isn't to blame, the video comes over the network from the real
  site. I didn't want to just let it wait longer — then the freezes would be
  invisible. So: if the video stops, the test gives it up to 10 s. It moves
  on — the test is green, but marked in the report "video froze for N s". It
  doesn't — the test fails. A broken player never moves on, so it's still
  caught. Checked it by freezing the video on purpose: for 8 s — the test
  passed with the mark, for good — it failed.
- I also asked for an outside review of the finished repo, and it found a
  weak spot: the 3 videos with duration 0 were handled with `test.fail`, so
  the test would stay "green" with a thousand new broken videos too, or even
  with a broken API. Now it's a list of the 3 known ids. Any new broken video
  fails the test, and a fixed one fails it too, so the list doesn't go stale.
  Same review pointed at `npm audit`: updated Allure and Zod, no critical or
  high ones left.
- In the reviewer's run the pricing test spent 100 s just opening the page,
  usually it's 1 s. That's clearly wrong, so I asked to dig into it. The test
  waited for the page to fully load, and some ad or analytics request just
  hung. The first fix (don't wait for full load) broke clicks once: the page
  was there, but the site's scripts weren't ready yet. Final version: wait
  for full load, but max 10 s, then go on with a warning in the report.
  Checked by hanging all images on purpose — the test passed in 15 s with
  the warning.

## To make it easier for the next person

All the pitfalls the AI and I ran into, and the rules we ended up with, I
put into [CLAUDE.md](CLAUDE.md). It's a short instruction Claude reads by
itself every time it works with the repo: how to write tests, what not to do
on the live site and where the traps are (no video tag, disappearing player
buttons, premium in the results). So the next tester or their AI won't have
to figure it out again.

## Summary

With AI I did it much faster, but the test became reliable not because of
the AI, but because of the checks: runs on the live site, tests broken on
purpose, review and repeated runs.

## Appendix: detailed log

- Exploration in the browser: the first search result for `iceland` was premium and opened a paywall instead of playing.
- The player has no `<video>` in the DOM; the frames are drawn on a WebGL canvas. A check on `video.paused` would not work.
- The playing state was proven by wrapping `HTMLMediaElement.prototype.play` and reading `paused` / `currentTime` of the detached element.
- A link pattern `/<six characters>` for videos also matched `/photos`.
- The start button of the player has no accessible name.
- Decision: path search → free video → playback; proof by the `Pause` button, the growing time and the intercepted media element.
- I wrote the scenario as 13 steps in my own words (the table has 12: the last step "pause, play" became two, the first two became a precondition and a check); the AI turned it into the table of SCENARIO.md and checked every step on the live site first.
- Changes the AI proposed to my draft, and why:
  - "the user is not logged in" became a precondition plus a check (`Sign In` in the header);
  - "click the first result" stays, but the first result must be the expected free video: the second result for `Immersive Iceland` is premium;
  - "the time matches the time on the search page" was ambiguous: the duration (`04:09`) matches, the current time grows;
  - "pause, play" was split into two steps with their own expected results: after the pause the time stops and the button becomes `Play`; after play the video continues from the paused position.
- The player has a `Play in VR` button next to `Play`, so the `Play` locator needs an exact name.
- Scope of the player: only what the path uses and what proves the result is described; the other controls are a separate player test.
- First run in Playwright: steps 1–9 passed at once. The bundled Chromium plays the video, a fresh context shows the start button (no autoplay), so both open questions of the exploration were answered by the run.
- Step 10 failed: the time text was `""`. The screenshot of the failure showed why: the player hides its controls a few seconds after the last mouse move, and `innerText` of a hidden element is empty. Fix: move the mouse over the player before every action on the controls, as a user does.
- A detail found on the way: a hover on the point where the mouse already is sends no move event, so the controls do not come back. The hover point alternates.
- A type error in the first version (`toEqual<VideoCard>` does not take a type argument) was caught by `npm run typecheck`, not by the run.
- Verification of the test itself: a mutation (the pause click removed) makes the test fail on step 11; 5 of 5 runs in a row passed without retries.
- Safari and phones added (Playwright projects `desktop-safari`, `mobile-chrome` = Pixel 7, `mobile-safari` = iPhone 15). Desktop Safari passed at once.
- The phones failed on step 1: the `Sign In` label is hidden on a phone (`display: none`), so the button has no accessible name. The search field is behind a `Search` button. Both were found from the screenshot of the failure and the accessibility snapshot of the header.
- A wrong conclusion of the AI on the way: an exploration script showed "another video" as the first result on a phone. It had read the cards before the results were rendered; opened directly, the results were the same as on the desktop. The test itself was not affected, because it waits for `Search results` and checks the card.
- The phone player has different controls: two buttons without any name, which differ only by the icon (`#play`/`#pause`, `#forward`).
- Pause on a phone did nothing. The cause: after ~4 s the controls fade to `opacity: 0` but stay in place, Playwright still considers them visible, and the first tap only shows them. "Shown" is now decided by the real opacity; on a phone every press is a tap.
- That fix broke desktop Safari: it hides the controls with `visibility`, not with opacity. `checkVisibility({ visibilityProperty: true })` was added. (Inferred from the empty `innerText` and confirmed only by the fix working, not by reading the styles.)
- In one exploration on the emulated iPhone the first tap on play started nothing; a later attempt that waited for the `#play` button worked. Most likely the tap came before the player was ready. It did not reappear in the 5 stability runs and the single runs of `mobile-safari`.
- Result: 20 of 20 runs (5 per project); the mutation (no pause) fails on the desktop and on both phones.
- Review by the `qa-reviewer` agent (reviews/REVIEW.md): no blocker, 1 major, 9 minor. The major one was mine: the code used a 5 s growth window and a start budget of up to 35 s, while SCENARIO.md says 1 s within 3 s and 15 s, and the comment claimed "Thresholds of SCENARIO.md".
- One finding was half wrong: the agent doubted that the paywall has `role="dialog"`, but its probe opened the premium video without clicking play, so the paywall could not appear. My exploration had matched it as a dialog after the click.
- Fixes: thresholds as in the scenario, measured from the click; the paywall checked after the click with its own message; "continues from the pause" checked over the whole 3 s window; card values checked with retrying assertions; the exact path of the video; exactly one started media element from the player's CDN; no swallowed locator errors; messages on every assertion; test timeout 180 s.
- Two more mutations prove the media checks: without the UI check the test fails on "The media element must be paused"; a restart from 0 fails on "currentTime must never drop below …".
- The first stability run after the fixes: 19 of 20. One `desktop-chrome` run failed in step 12 (0.45 s growth in 3 s, 2 samples). Not reproduced in 8 + 20 runs, cause unknown; the samples now record time and `readyState`.
- The second run: 17 of 20, three failures on `mobile-chrome` in step 11. The cause was the race the reviewer listed as a risk, plus a bug nobody had seen: the "reveal" tap at (40, 40) of the player hits the `Play in VR` button on a phone. A tap also toggles the controls instead of restarting their timer. Fix: a free point on the bare video, and on a phone "wait until the controls hide, tap once, press at once".
- Then: phones 10 of 10, all projects 20 of 20; the three mutations fail where intended on the desktop and on the phone.

- Playwright 1.64 features taken over: a video of the run with the step titles shown by Playwright itself (`video.show.test.level: 'step'`, `npm run test:video`); `default: false` for three projects, so `npm test` runs one fast project; traces with aria and screen snapshots; step parameters. `locator.waitForFunction` (planned) was not needed in the end, see below.
- The first video run hung on the desktop: with action highlighting every action took seconds (`Hover` 7.2 s), and the controls hid before the click. The new `npx playwright trace` CLI showed it in two commands, and the same trace showed the real attributes of the player: `data-testid="play-pause-btn"`, `data-testid="player-overlay"` with `data-ui-hidden`.
- That corrected my exploration: I had written "no data-testid on this path" after checking only the search cards. The player has test ids. The CSS-class and opacity tricks for the player were replaced by `data-testid` and `toHaveAttribute('data-ui-hidden', …)`, which also made `waitForFunction` unnecessary.
- New desktop interaction: move the mouse onto the button and click at once. The state of Pause/Play is asserted as attached (with `includeHidden`), because the controls can be faded out at that moment.
- The touch point on the video is now checked with `elementFromPoint` before the tap; a control under it fails the test with its name.
- Stability after that: 18 of 20. (1) `desktop-safari`, step 9: `paused: false` but `currentTime` stayed 0.00 for 3 s with `readyState` 3, a real stall at the start, caught by the test; cause unknown, not loosened. (2) `desktop-chrome`, step 10: a test error. The trace showed each read of the time text took 0.5–2.3 s, so a 3 s poll made two reads; the player updates the text about once a second with a lag (checked: it also updates while the controls are hidden). Fix: the shown time is sampled inside the page over the window, like `currentTime`.
- Then: 4 of 4 single runs, 20 of 20 stability runs (11 min); the three mutations (no pause; no pause without the UI check; restart from 0) fail in steps 11, 11 and 12 on `desktop-chrome` and `mobile-chrome`.
- Allure added (allure-playwright 3.14, Allure 3 CLI 3.21 without Java): a single-file report grouped by feature → story → environment, evidence attached to every timing check, failure categories. Allure 3 ignores the categories of the reporter: they had to move to `allurerc.mjs`. A mutation showed that one message did not name its cause ("The page shows the expected premium video" landed in "Product errors"); the message was rewritten.
- "Started" now means "the time moves" within the 15 s budget (buffering included), "resumed" means "the time moves on" within 5 s; the growth window starts after that. This removes the start stall from the growth check without loosening it.
- A latent bug found while exploring the premium page: the paywall locator matched two nested dialogs, so a paywall would have failed with a strict mode error instead of its message. Now the unique heading is used.
- New tests: the paywall of a premium video (UI); the premium plans by calculation, no prices in the code (UI); the DeoVR JSON contract and the comments API (API, Zod schemas). The schemas were wrong twice at first (empty codec lists, a comment text is an object): the contract tests caught my own assumptions.
- The API tests found real issues: 3 library videos with length 0 (first kept as a known issue with `test.fail`, later replaced by exceptions by id, see below), `fullAccess: true` on a premium video, a 13 MB library.
- Mutations of the new tests: a wrong badge, a wrong checkout total, another currency, a premium video that became free, a leaked stream URL. Each fails in the intended step with a message that names it.
- My mistake on the way: I moved the spec files into `tests/ui/` while a stability run was going; the run had to be thrown away.
- Stability of all tests: 94 of 95. The failure was a resume stall on `desktop-safari` (not paused, time standing at 9.07 s for 5 s), correctly placed in "Playback stalled" by the report. Not loosened; the wait now records `readyState`. A mutation that freezes the video (`playbackRate = 0`) shows the new message: the time stands with `readyState` 4, i.e. the data is there and the video does not play.
- Final clean run: 19 of 19.
- Video: every run records a plain video, kept and attached to Allure only for a failed test (`retain-on-failure`, without the action highlighting that had slowed the actions down). Checked with a mutation: the failed test had the video and the screenshot in Allure, the passed one had none.
- Stability with the failure video on: 95 of 95, 15.6 min (16.3 min without). A failure in Allure carries the screenshot, the video, the error context and the trace (`application/vnd.allure.playwright-trace`).
- An outside review of the finished repo: `test.fail` on the duration test accepted any failure (a thousand new broken videos, an HTTP error, a broken schema). Replaced by exceptions for the 3 known ids (`tests/data/known-issues.ts`, with a review date). A new item, another value for a known item, a fixed known item or a passed review date fails the test. The rule is a pure function, tested on made-up libraries (`tests/api/library-durations.spec.ts`); a live mutation (one known id removed from the list) failed with "1 new item(s) without one".
- `npm audit`: 7 critical, 1 high before; Allure 3.33.0 and Zod 4.6.7 leave 6 moderate inside Allure (`glob`, `minimatch`). `npm audit fix --force` would install `allure@0.0.0`, so it was not used. Typecheck, all 27 tests in all projects and the Allure report pass with the new versions.
- The second outside review: the pricing test spent 100.4 s in step 1 in one `desktop-chrome` run (1–3 s elsewhere). Not reproduced in 3 + 10 runs; `page.goto` waited for the `load` event, held by a hanging request, without a navigation limit. `waitUntil: 'domcontentloaded'` alone failed once in two full runs: a click on a plan was lost before the scripts of the site attached their handlers (the page is server-rendered). Final: `openPage` waits for `load` up to 10 s, then goes on with a `warning` annotation and the Allure tag `slow-page-load` listing the pending requests; `navigationTimeout` 30 s for the document. A mutation that hangs all images on /join passed in 15.2 s with the warning; two full runs passed 27 of 27.
- The same review: the schema test "without duration" also lacked `thumbnailUrl`, so it passed even without the duration rule. Now the example is valid except for the duration and the error path `scenes.0.list.0.videoLength` is asserted; removing `videoLength` from the schema fails it.
