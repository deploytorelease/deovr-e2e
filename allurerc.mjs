import { defineConfig } from 'allure';

/**
 * The Allure 3 report of the tests (`npm run report:allure`).
 *
 * Grouped by what the tests protect (feature → story) and then by the
 * environment (desktop-chrome, mobile-safari, ...). One self-contained HTML
 * file: it opens without a server, so it can be sent or attached as it is.
 */
export default defineConfig({
  name: 'DeoVR E2E',
  output: './allure-report',
  // Failures grouped by their cause. The rules are matched in order against
  // the failure message; the tests write their messages to name the cause.
  // Anything else falls into the default categories of Allure (product and
  // test errors).
  categories: [
    {
      name: 'Test data out of date',
      matchers: { statuses: ['failed', 'broken'], message: /search ranking changed|not free any more|not premium any more|update tests\/data/ },
    },
    {
      name: 'Content protection',
      matchers: { statuses: ['failed', 'broken'], message: /premium video must not start|must not start the premium video|content protection|paywall .*must open/ },
    },
    {
      name: 'Prices and checkout',
      matchers: { statuses: ['failed', 'broken'], message: /badge|checkout|same currency|billed|sale price/i },
    },
    {
      name: 'Playback stalled (site or network)',
      matchers: { statuses: ['failed', 'broken'], message: /must move past|must grow by at least|shown by the player must grow/ },
    },
    {
      name: 'Site did not load',
      matchers: { statuses: ['failed', 'broken'], message: /page\.goto: (Timeout|net::)/ },
    },
    {
      name: 'Library data and known issues',
      matchers: { statuses: ['failed', 'broken'], message: /positive duration|known issue/i },
    },
    {
      name: 'API contract',
      matchers: { statuses: ['failed', 'broken'], message: /contract|must answer with HTTP|answer with JSON/ },
    },
    {
      name: 'Test defects: locators and timing',
      matchers: { statuses: ['failed', 'broken'], message: /strict mode violation|lies on a control|controls of the player must|Test timeout/ },
    },
  ],
  plugins: {
    awesome: {
      options: {
        reportName: 'DeoVR E2E',
        singleFile: true,
        groupBy: ['feature', 'story', 'parentSuite'],
        // A failed step opens by itself; passed steps stay collapsed.
        stepTreeExpansion: 'expand_failed_only',
      },
    },
  },
});
