import type { KnownDurationIssue } from '../../src/api/library-durations';

/**
 * Library items of `/deovr` known to have no duration. Each one is tolerated
 * only with exactly this `videoLength`; a new item, another value or a fixed
 * item fails the test. No bug tracker is available for deovr.com, so the
 * exceptions carry the date they were found and a review date instead.
 */
export const KNOWN_ZERO_DURATIONS: readonly KnownDurationIssue[] = [
  {
    id: 122691,
    videoLength: 0,
    reportedOn: '2026-11-05',
    reviewBy: '2027-02-01',
    note: 'Title "20260530_053848": looks like a raw upload',
  },
  {
    id: 122600,
    videoLength: 0,
    reportedOn: '2026-11-05',
    reviewBy: '2027-02-01',
    note: 'Title "ME IN NEON LIGHT"',
  },
  {
    id: 14880,
    videoLength: 0,
    reportedOn: '2026-11-05',
    reviewBy: '2027-02-01',
    note: 'Title "Workfflow_test_3D_360_Canon_R5c_3d_neu2": looks like a test upload',
  },
];
