import { errors, type Page, type Request } from '@playwright/test';
import { reportSlowPageLoad } from '../report';

/**
 * How long a test waits for the `load` event after the document is there.
 *
 * Waiting for `load` lets the scripts of the site attach their handlers
 * before the test clicks (the page is rendered on the server, so its elements
 * exist before they react). But the pages also load ads, analytics and
 * reCAPTCHA, and one hanging third-party request once held `load` of /join
 * for 100 s. After this grace the test goes on with a warning in the report.
 */
const LOAD_GRACE_MS = 10_000;

/** Opens a path of the site; returns the HTTP status of the document. */
export async function openPage(page: Page, path: string): Promise<number | undefined> {
  const pending = new Set<Request>();
  const track = (request: Request): void => {
    pending.add(request);
  };
  const untrack = (request: Request): void => {
    pending.delete(request);
  };
  page.on('request', track);
  page.on('requestfinished', untrack);
  page.on('requestfailed', untrack);
  try {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    await waitForLoadOrWarn(page, path, pending);
    return response?.status();
  } finally {
    page.off('request', track);
    page.off('requestfinished', untrack);
    page.off('requestfailed', untrack);
  }
}

async function waitForLoadOrWarn(page: Page, path: string, pending: ReadonlySet<Request>): Promise<void> {
  try {
    await page.waitForLoadState('load', { timeout: LOAD_GRACE_MS });
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) {
      throw error;
    }
    await reportSlowPageLoad(
      `${path}: the page did not finish loading within ${LOAD_GRACE_MS} ms (a request hangs); the test goes on`,
      { pendingRequests: [...pending].map((request) => request.url()) },
    );
  }
}
