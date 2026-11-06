# DeoVR E2E: search a video, play, pause and resume

End-to-end tests of <https://deovr.com/> on Playwright + TypeScript.

| Test                               | Layer | What it checks                                                    |
| ---------------------------------- | ----- | ----------------------------------------------------------------- |
| `tests/ui/search-and-play.spec.ts` | UI    | A visitor finds a free video, plays it, pauses and resumes it     |
| `tests/ui/premium-paywall.spec.ts` | UI    | A premium video shows the paywall, and no video starts behind it  |
| `tests/ui/pricing.spec.ts`         | UI    | The premium plans: discounts, totals and the checkout add up      |
| `tests/api/deovr-json.spec.ts`     | API   | The DeoVR JSON API: free and premium videos, the library          |
| `tests/api/comments.spec.ts`       | API   | The comments API: the required header, the pagination             |
| `tests/api/library-durations.spec.ts` | Unit | The duration rule of the library test, on made-up data (no network) |

| Document                         | Content                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| [SCENARIO.md](SCENARIO.md)       | The user path, why it was chosen, preconditions, steps, results |
| [AI_WORKFLOW.md](AI_WORKFLOW.md) | How AI was used, the key prompts, what had to be fixed          |
| [CLAUDE.md](CLAUDE.md)           | Rules and pitfalls of the site for whoever changes the tests    |

## Requirements

- Node.js 20 or newer
- Internet access to `deovr.com`

## Run

```bash
npm install
npx playwright install chromium webkit
npm test
```

`npm test` runs the `api` and `desktop-chrome` projects (about a minute).
`npm run test:all` runs all five:

| Project          | Engine          | Device                     |
| ---------------- | --------------- | -------------------------- |
| `api`            | none (HTTP)     | —                          |
| `desktop-chrome` | Chromium        | desktop 1280×720           |
| `desktop-safari` | WebKit (Safari) | desktop 1280×720           |
| `mobile-chrome`  | Chromium        | Pixel 7, emulated, touch   |
| `mobile-safari`  | WebKit (Safari) | iPhone 15, emulated, touch |

| Command                                       | What it does                                              |
| --------------------------------------------- | --------------------------------------------------------- |
| `npm test`                                    | The `api` and `desktop-chrome` projects                   |
| `npm run test:all`                            | All five projects                                         |
| `npm run test:desktop`                        | `desktop-chrome` and `desktop-safari`                     |
| `npm run test:mobile`                         | `mobile-chrome` and `mobile-safari`                       |
| `npx playwright test --project=mobile-safari` | One project                                               |
| `npx playwright test --project=api`           | Only the API tests (no browser, a few seconds)            |
| `npm run test:headed`                         | In a visible browser                                      |
| `npm run test:video`                          | Records a video of the run with the step titles           |
| `npm run test:stability`                      | Every test 5 times in every project, without retries      |
| `npm run typecheck`                           | TypeScript in strict mode                                 |

## Reports

```bash
npm run report                # the Playwright HTML report of the last run
npm run report:allure         # builds the Allure report: allure-report/index.html
npm run report:allure:open    # serves the Allure report in the browser
```

The Allure report is one HTML file (Allure 3, no Java needed). It shows the
steps of SCENARIO.md, the data every check was decided on, and groups the
failures by their cause.

A failed test keeps a screenshot, a video and a Playwright trace in
`test-results/`; they are attached to both reports. To open a trace:

```bash
npx playwright show-trace test-results/<test>/trace.zip
```

`npm run test:video` records `test-results/<test>/video.webm` with every
action highlighted and the current step shown in the corner. Add
`-- --project="*"` for all five projects.
