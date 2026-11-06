import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { attachEvidence, describeTest } from '../../src/report';
import { EXPECTED_VIDEO } from '../data/video';

/**
 * The comments API of the site (`api.deovr.com/ugc/v1`).
 *
 * Not documented publicly: the headers are the ones the web client sends
 * (`Client-Type: web`, `Project: 13`). Read only.
 */
const API = 'https://api.deovr.com/ugc/v1';
const WEB_CLIENT = { 'Client-Type': 'web', Project: '13' };

const errorSchema = z.object({ error: z.object({ code: z.number().int(), message: z.string() }) });

const commentsSchema = z.object({
  data: z.array(
    z.object({
      id: z.number().int().positive(),
      // The text is an object: the original text, possibly with translations.
      text: z.object({ original: z.string() }),
      date: z.number().int().positive(),
      deleted: z.boolean(),
      author: z.object({ id: z.string().min(1), name: z.string() }),
    }),
  ),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().positive(),
      perPage: z.number().int().positive(),
      totalCount: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  }),
});

test.describe('Comments API', () => {
  test.beforeEach(async () => {
    await describeTest({
      feature: 'Comments API',
      story: 'The comments of a video for the web client',
      severity: 'normal',
      description:
        'The API the video page uses for its comments. It requires the header of a client and paginates; ' +
        'the pagination is checked by calculation, not against fixed numbers.',
      links: [{ url: `https://deovr.com${EXPECTED_VIDEO.path}`, name: 'Video of the comments' }],
    });
  });

  test('a request without the client header is rejected with a JSON error', async ({ request }) => {
    const response = await request.get(`${API}/videos/${EXPECTED_VIDEO.apiId}/comments?perPage=1`);
    expect(response.status(), 'Without "Client-Type" the API must answer with HTTP 400').toBe(400);
    const body = errorSchema.parse(await response.json());
    await attachEvidence('The error', body);
    expect(body.error.message, 'The error names the missing header').toContain('Client-Type');
  });

  test('comments are paginated consistently', async ({ request }) => {
    const perPage = 2;
    const response = await request.get(
      `${API}/videos/${EXPECTED_VIDEO.apiId}/comments?perPage=${perPage}&page=1&sort=recent`,
      { headers: WEB_CLIENT },
    );
    expect(response.status(), 'With the client headers the API must answer with HTTP 200').toBe(200);
    const parsed = commentsSchema.safeParse(await response.json());
    expect(parsed.success ? [] : parsed.error.issues, 'The response must match the comments contract').toEqual([]);
    const { data, meta } = parsed.data as z.infer<typeof commentsSchema>;
    await attachEvidence('The pagination and the comment ids', {
      pagination: meta.pagination,
      ids: data.map((comment) => comment.id),
    });

    const { page, totalCount, totalPages } = meta.pagination;
    expect(meta.pagination.perPage, 'The API echoes the requested page size').toBe(perPage);
    expect(page, 'The first page was requested').toBe(1);
    expect(data.length, 'A page never holds more than the page size').toBeLessThanOrEqual(perPage);
    expect(data.length, 'The first page holds min(page size, total) comments').toBe(Math.min(perPage, totalCount));
    expect(totalPages, 'totalPages = ceil(totalCount / perPage)').toBe(Math.ceil(totalCount / perPage));
    expect(new Set(data.map((comment) => comment.id)).size, 'No comment appears twice on a page').toBe(data.length);
  });
});
