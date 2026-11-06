# Test scenario: search a video, open it, play, pause and resume

## The user path

- Link: <https://deovr.com/> → <https://deovr.com/search?q=Immersive%20Iceland> → <https://deovr.com/y2yde2>
- Why this path: finding a video and watching it is the main job of DeoVR. The
  path crosses the search, the navigation to a video page, the separation of
  free and premium content and the player, which is the most complex part of
  the page (a WebGL VR player without a `<video>` element in the DOM).

## Preconditions

- A fresh browser context: no cookies, no saved session, no previous visit
  (the autoplay of a known profile must not start the video by itself).
- The user is not logged in.
- One of the four environments below. The steps and the expected results are
  the same everywhere; only the way a step is performed differs.

| Environment      | Engine            | Device                          |
| ---------------- | ----------------- | ------------------------------- |
| `desktop-chrome` | Chromium          | desktop, 1280×720, mouse        |
| `desktop-safari` | WebKit (Safari)   | desktop, 1280×720, mouse        |
| `mobile-chrome`  | Chromium          | Pixel 7 (emulated), touch       |
| `mobile-safari`  | WebKit (Safari)   | iPhone 15 (emulated), touch     |

## Test data

| Data              | Value                                                                               | Why this value                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Search query      | `Immersive Iceland`                                                                 | Finds the expected video as the first result                                                                   |
| Expected path     | `/y2yde2`                                                                           | Step 7 checks this exact path, not any six-letter path (`/photos` has six letters too)                         |
| Expected video    | `Immersive Iceland & Beyond: Northern Lights, Wildlife & Nature \| 3D VR180 Showreel` | A **free** video. The second result for this query is premium, so "the first result" alone is not test data |
| Expected channel  | `Arni Hrolfsson`                                                                    | A second attribute to prove that the right video was opened                                                    |
| Expected duration | `04:09`                                                                             | Shown on the search card, in the player and as the duration of the media                                       |

## Steps

| #   | Step                                                           | Expected result                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open `https://deovr.com/`.                                     | The page loads with HTTP 200 and the title contains `DeoVR`. The header shows `Sign In`: the user is not logged in.                                                                                                                      |
| 2   | Check the search field.                                        | Exactly one textbox with the placeholder `I'm looking for...` is visible and enabled.                                                                                                                                                    |
| 3   | Click the search field.                                        | The search field has the focus.                                                                                                                                                                                                          |
| 4   | Type `Immersive Iceland`.                                      | The search field contains `Immersive Iceland`.                                                                                                                                                                                           |
| 5   | Press Enter.                                                   | The URL is `/search?q=Immersive%20Iceland` (or `+` instead of `%20`). The heading `Search results` is visible and at least one result card is shown.                                                                                 |
| 6   | Remember the first card of the results: title, channel, duration. | The title of the first card is the expected video, the channel is `Arni Hrolfsson`, the duration is `04:09`. If not, the test stops with "the search ranking changed, the test data must be updated" (and does not play another video). |
| 7   | Click the title of the first card.                             | The video page of the expected video opens: the URL is `https://deovr.com/y2yde2`. |
| 8   | Compare the video page with the remembered card.               | The page heading equals the title of the card, the channel equals the channel of the card. |
| 9   | Click the start button in the centre of the poster.            | Within 15 s of the click (buffering included): the player switches to `Pause`, the media element is not paused and its time starts to move. No `Unlock DeoVR Premium` paywall: if it appears, the test fails with "the video is not free any more". Then `currentTime` grows by at least 1 s within 3 s and never goes back. A stall of the live video gets up to 10 s more: if the time moves on, the step passes with a warning in the report; if not, it fails. |
| 10  | Compare the time of the player.                                | The duration in the player is `04:09`, equal to the duration on the search card. The duration of the media element rounds down to the same `mm:ss`. The current time in the player is not `00:00` and grows.                            |
| 11  | Click `Pause`.                                                 | The button changes to `Play`; the media element is paused; `currentTime` does not change for 2 s (tolerance 0.25 s); the current time in the player stays the same.                                                                     |
| 12  | Click `Play`.                                                  | The button changes to `Pause`; the media element is not paused; within 5 s (re-buffering included) the time moves on from the paused position; then during 3 s `currentTime` never drops below the paused position (no restart from 0) and grows by at least 1 s. A stall gets up to 10 s more, as in step 9; a restart from 0 is never excused. |

## Second scenario: a visitor cannot play a premium video

- Link: <https://deovr.com/wgp2ar> (`Iceland Travel 冰岛Vlog 🇮🇸｜Prologue预告`, premium).
- Why: the first scenario plays a free video; this one proves the other side of
  the same rule. Premium content is the business of the site, and "the paywall
  opened" alone is not enough: no video may start behind it.
- Preconditions: as above (fresh context, not logged in, one of the four environments).

| #   | Step                                         | Expected result |
| --- | -------------------------------------------- | --------------- |
| 1   | Open `https://deovr.com/wgp2ar`.             | HTTP 200, `Sign In` in the header, the heading is the expected title. The page shows a preview (a button "video preview …") and no player; if a player is shown, the video is not premium any more and the test stops with that message. |
| 2   | Press play on the preview.                   | The paywall `Unlock DeoVR Premium` opens with the buttons `Get Premium` and `Log in`. |
| 3   | Wait 3 s.                                    | No media element starts. |
| 4   | Close the paywall with `Close`.              | The paywall closes; still no media element starts within 3 s. |

## Third scenario: the premium plans add up

- Link: <https://deovr.com/join>
- Why: a wrong price or total costs money and trust. Prices, discounts and the
  currency change (sales, regions), so the expected results are calculations,
  not numbers. Nothing is submitted: choosing a plan only changes the checkout.

| #   | Step                                  | Expected result |
| --- | ------------------------------------- | --------------- |
| 1   | Open `/join` and read the plans.      | More than one plan; each has a crossed out list price, a sale price, a period and a discount badge. |
| 2   | Compare the currencies.               | Every price uses the same currency. |
| 3   | For every plan: compare the badge.    | The sale price is below the list price; the badge equals `1 − sale / list` in percent, rounded (down or to the nearest). |
| 4   | For a plan with "Billed as".          | The billed amount equals the price per period × the number of periods (12 for an annual plan), up to the rounding of the period price to cents. |
| 5   | Choose every plan, one after another. | Exactly that plan is `Selected`; the checkout total is what the plan charges (the billed amount or the price) in the same currency; a recurring plan says "Rebills at <total> every <month/year>", a one-time plan says "One-time". |

## API checks

Read only (`GET`), as a visitor, no browser.

| Check | Expected result |
| --- | --- |
| `/deovr/video/id/140261` (the free video of the first scenario) | HTTP 200, JSON that matches the contract; `isPremium: false`; the duration equals the duration on the search card (`04:09`); every stream URL is on `cdn-vr.deovr.com`. |
| `/deovr/video/id/125968` (the premium video of the second scenario) | `isPremium: true`; no stream URL is given to a visitor. |
| `/deovr` (the app library) | Matches the contract; the first three videos, whatever they are today, resolve to a video with the same id and duration. Every video has a positive duration, except the known items listed by id in `tests/data/known-issues.ts` (3 with duration 0). A new item without a duration, a known item with another value, a fixed known item or a passed review date fails the test. |
| `/deovr/video/id/999999999` | HTTP 404 with a JSON body. |
| Comments without `Client-Type` | HTTP 400, the error names the header. |
| Comments with the web client headers, page size 2 | HTTP 200, matches the contract; the page holds `min(2, total)` comments, no duplicate; `totalPages = ⌈totalCount / perPage⌉`. |

## The differences of the phone layout

| Step | Desktop                                              | Phone                                                                                       |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | `Sign In` is a visible button with that name         | The label `Sign In` is hidden (`display: none`): the button is an icon without a name       |
| 2    | The search field is in the header                    | The search field opens with the `Search` button of the header                               |
| 9    | A start button in the centre of the poster           | A play button next to a forward button; the same button plays and pauses                    |
| 11–12 | `Pause` / `Play` buttons with a `title`; the test moves the mouse onto the button (this shows the controls) and clicks it at once | Buttons without a name, recognised by their icon. A tap toggles the controls, so the test waits until they hide (`data-ui-hidden`), shows them with one tap on the bare video (not the top left corner: that is `Play in VR`) and presses at once |

## How "the video plays" is proven

The player draws the frames on a WebGL canvas and keeps its media element out
of the DOM. Before the page loads, the test wraps
`HTMLMediaElement.prototype.play` and keeps a reference to every element that
the player starts. The wrapper only observes: it calls the original `play`
on the same element (`play()` takes no arguments) and returns its promise
unchanged. The test requires that exactly one media element was started and
that its source is the CDN of the player (`cdn-vr.deovr.com`), so an ad or a
preview cannot be read as the video. The checks of steps 9–12 read
`paused`, `currentTime` and `duration` of that element and compare them with
the controls the user sees.

## Out of scope

- The other player controls: mute, quality, fullscreen, camera reset, next video, VR mode. They are a separate test of the player, not of this path.
- Buying premium, sign-up, login and promo codes: the tests choose a plan but never submit the checkout.
- The video quality and the content of the frames.
- Real devices: the phone environments are emulated (viewport, touch, user agent) on a desktop engine.
- Firefox.
