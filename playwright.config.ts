import os from 'node:os';
import { defineConfig, devices, type PlaywrightWorkerOptions } from '@playwright/test';
import type AllureReporter from 'allure-playwright';

/** The configuration type of the reporter (the package does not export it by name). */
type AllurePlaywrightReporterConfig = NonNullable<ConstructorParameters<typeof AllureReporter>[0]>;

/**
 * A recorded walkthrough of the run, switched on with `QA_VIDEO=1`
 * (`npm run test:video`). Playwright highlights every action and shows the
 * title of the current `test.step` on the video, so the twelve steps of
 * SCENARIO.md appear as chapters without any code in the test.
 */
const walkthrough: PlaywrightWorkerOptions['video'] = {
  mode: 'on',
  fps: 30,
  show: {
    actions: { position: 'top-left' },
    test: { level: 'step', position: 'top-right' },
  },
};

/**
 * The Allure report: the steps of the scenario, the evidence of every check,
 * the environment and the failures grouped by their cause.
 *
 * The categories of the failures are defined in `allurerc.mjs`, the
 * configuration of the Allure 3 report.
 */
const allure: AllurePlaywrightReporterConfig = {
  resultsDir: 'allure-results',
  // Only the steps of the scenario and their assertions; the low-level
  // Playwright calls stay in the trace that is attached to a failure.
  detail: false,
  environmentInfo: {
    'Site': 'https://deovr.com',
    'Playwright': '1.64.1',
    'Node.js': process.version,
    'OS': `${os.type()} ${os.release()}`,
  },
};

/**
 * The test runs against the live site, so the configuration is conservative:
 * no retries (a flaky test has to be visible), one worker (one visitor, no
 * load on the site), a fresh browser context per test (no cookies, no
 * autoplay history).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env['CI']),
  // The sum of the waits of the 12 steps; a slow site fails in a step, not in the global timeout.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['allure-playwright', allure]],
  use: {
    baseURL: 'https://deovr.com',
    locale: 'en-US',
    // A document that does not arrive fails within 30 s. A hanging request of
    // a loaded page is handled by `openPage` (src/pages/navigation.ts).
    navigationTimeout: 30_000,
    // A failed run keeps a trace with a screenshot and the accessibility tree
    // of every action: on this site most problems were "no accessible name"
    // and "the controls are transparent", and both are visible there.
    trace: { mode: 'retain-on-failure', snapshots: { dom: true, aria: true, screen: true } },
    screenshot: 'only-on-failure',
    // Every run records a plain video (no action highlighting, which slows the
    // actions down) and keeps it only for a failed test; it is attached to the
    // Allure report next to the screenshot and the trace. `QA_VIDEO=1` records
    // the annotated walkthrough of every test instead.
    video: process.env['QA_VIDEO'] === '1' ? walkthrough : 'retain-on-failure',
  },
  // Two engines (Chromium, WebKit = Safari) on a desktop and on a phone.
  // The mobile projects emulate the viewport, the touch input and the user
  // agent of the device; they are not real devices.
  //
  // `npx playwright test` runs `api` and `desktop-chrome` (the projects with
  // `default: false` are skipped), `--project="*"` runs all five.
  projects: [
    {
      // HTTP only, no browser: the DeoVR JSON API and the comments API.
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
    },
    {
      name: 'desktop-chrome',
      testMatch: 'ui/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'desktop-safari',
      testMatch: 'ui/**/*.spec.ts',
      default: false,
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'mobile-chrome',
      testMatch: 'ui/**/*.spec.ts',
      default: false,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      testMatch: 'ui/**/*.spec.ts',
      default: false,
      use: { ...devices['iPhone 15'] },
    },
  ],
});
