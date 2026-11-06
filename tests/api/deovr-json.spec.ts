import { expect, test, type APIRequestContext } from '@playwright/test';
import type { z } from 'zod';
import { librarySchema, streamUrls, videoSchema, type DeoVrVideo } from '../../src/api/deovr-json';
import { checkLibraryDurations, libraryItemId } from '../../src/api/library-durations';
import { attachEvidence, describeTest } from '../../src/report';
import { toClock } from '../../src/time';
import { KNOWN_ZERO_DURATIONS } from '../data/known-issues';
import { EXPECTED_VIDEO, PREMIUM_VIDEO } from '../data/video';

/**
 * The DeoVR JSON API: the contract the DeoVR app relies on.
 *
 * Read only (GET), no authentication: the tests see what a visitor's app sees.
 */

/** GETs a JSON resource, checks the status and the content type, and validates the body. */
async function getJson<T extends z.ZodType>(
  request: APIRequestContext,
  path: string,
  schema: T,
): Promise<z.infer<T>> {
  const response = await request.get(path);
  expect(response.status(), `GET ${path} must answer with HTTP 200`).toBe(200);
  expect(response.headers()['content-type'], `GET ${path} must answer with JSON`).toContain(
    'application/json',
  );
  const body: unknown = await response.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    await attachEvidence(`GET ${path}: response that broke the contract`, body);
  }
  expect(
    parsed.success ? [] : parsed.error.issues,
    `GET ${path}: the response must match the DeoVR JSON contract`,
  ).toEqual([]);
  return parsed.data as z.infer<T>;
}

const STREAM_HOST = 'https://cdn-vr.deovr.com/';

type Library = z.infer<typeof librarySchema>;

/**
 * The library is one JSON of about 13 MB (48,740 videos on 2026-11-05). It is
 * fetched once per worker and shared by the tests that need it.
 */
let library: Promise<Library> | undefined;
function getLibrary(request: APIRequestContext): Promise<Library> {
  library ??= getJson(request, '/deovr', librarySchema);
  return library;
}

test.describe('DeoVR JSON API', () => {
  test.beforeEach(async () => {
    await describeTest({
      feature: 'DeoVR JSON API',
      story: 'The app contract of deovr.com',
      severity: 'critical',
      description:
        'The JSON the DeoVR app reads from deovr.com (`/deovr`, `/deovr/video/id/<id>`), as described in the ' +
        'developer documentation. Read only, as a visitor.',
      links: [{ url: 'https://deovr.com/documentation', name: 'DeoVR developer documentation' }],
    });
  });

  test('a free video: the contract, the duration of the site and streams for a visitor', async ({ request }) => {
    const video: DeoVrVideo = await test.step('GET the free video', () =>
      getJson(request, `/deovr/video/id/${EXPECTED_VIDEO.apiId}`, videoSchema),
    );
    await attachEvidence('The free video (without description)', { ...video, description: undefined });

    await test.step('It is the video of the UI test, with the same duration', async () => {
      expect(video.id, 'The id of the response is the requested id').toBe(EXPECTED_VIDEO.apiId);
      expect(video.isPremium, 'The video of the UI test must be free: update tests/data/video.ts').toBe(false);
      expect(
        toClock(video.videoLength),
        'The duration in the API equals the duration the site shows on the search card',
      ).toBe(EXPECTED_VIDEO.duration);
    });

    await test.step('A visitor gets playable streams from the player CDN', async () => {
      const urls = streamUrls(video);
      expect(urls.length, 'The video offers at least one stream').toBeGreaterThan(0);
      for (const url of urls) {
        expect(url, 'Every stream of a free video is a URL on the player CDN').toMatch(
          new RegExp(`^${STREAM_HOST.replaceAll('.', '\\.')}.+\\.mp4`),
        );
      }
    });
  });

  test('a premium video exposes no stream to a visitor', async ({ request }) => {
    const video = await test.step('GET the premium video', () =>
      getJson(request, `/deovr/video/id/${PREMIUM_VIDEO.apiId}`, videoSchema),
    );
    await attachEvidence('The premium video (without description)', { ...video, description: undefined });

    await test.step('It is marked as premium', () => {
      expect(video.id, 'The id of the response is the requested id').toBe(PREMIUM_VIDEO.apiId);
      expect(video.isPremium, 'The video must be premium: if not, update tests/data/video.ts').toBe(true);
    });

    await test.step('No stream URL is given to a visitor', () => {
      const urls = streamUrls(video);
      const exposed = urls.filter((url) => url !== '');
      expect(
        exposed,
        'A premium video must not expose a stream URL to a visitor: the content protection of the API is broken',
      ).toEqual([]);
    });
  });

  test('the library lists videos whose links resolve to the same video', async ({ request }) => {
    const library = await test.step('GET the library', () => getLibrary(request));
    // Whatever the library contains today: the first three items of the first
    // scene are followed, nothing is hard coded.
    const items = library.scenes[0]?.list.slice(0, 3) ?? [];
    await attachEvidence('The followed library items', items);

    for (const item of items) {
      await test.step(`The link of "${item.title}" resolves to the same video`, async () => {
        const id = libraryItemId(item);
        const video = await getJson(request, new URL(item.video_url).pathname, videoSchema);
        expect(video.id, 'The linked video has the id of its link').toBe(id);
        expect(video.videoLength, 'The linked video has the duration the library announced').toBe(
          item.videoLength,
        );
      });
    }
  });

  test('every video of the library has a positive duration, except the known issues', async ({ request }) => {
    // "A positive duration" is our assumption: the DeoVR documentation does not
    // promise it. The library is what the app lists for playback, so an item
    // without a duration is treated as a defect.
    const items = (await getLibrary(request)).scenes.flatMap((scene) => scene.list);
    const result = checkLibraryDurations(items, KNOWN_ZERO_DURATIONS);
    await attachEvidence('Library durations', { total: items.length, knownIssues: KNOWN_ZERO_DURATIONS, ...result });

    expect(
      result.newViolations,
      `Every video the app lists must have a positive duration: ${result.newViolations.length} new item(s) without one`,
    ).toEqual([]);
    expect(
      result.changedKnownIssues,
      'A known issue must stay exactly as known: its duration changed to another invalid value',
    ).toEqual([]);
    expect(
      result.fixedKnownIssues.map((issue) => issue.id),
      'A known issue is fixed: remove it from tests/data/known-issues.ts',
    ).toEqual([]);
    const today = new Date().toISOString().slice(0, 10);
    expect(
      KNOWN_ZERO_DURATIONS.filter((issue) => issue.reviewBy < today).map((issue) => issue.id),
      'The review date of a known issue has passed: check it and update tests/data/known-issues.ts',
    ).toEqual([]);
  });

  test('an unknown video answers with 404 and a JSON error', async ({ request }) => {
    const response = await request.get('/deovr/video/id/999999999');
    expect(response.status(), 'An unknown id must answer with HTTP 404').toBe(404);
    expect(response.headers()['content-type'], 'The error is JSON').toContain('application/json');
  });
});
