import { expect, test } from '@playwright/test';
import { librarySchema } from '../../src/api/deovr-json';
import { checkLibraryDurations, type KnownDurationIssue, type LibraryItem } from '../../src/api/library-durations';

/**
 * The duration rule of the library test, checked on made-up libraries: every
 * way the real library could break the rule has to be caught. No network.
 */

const KNOWN: readonly KnownDurationIssue[] = [
  { id: 1, videoLength: 0, reportedOn: '2026-11-05', reviewBy: '2027-02-01', note: 'known' },
  { id: 2, videoLength: 0, reportedOn: '2026-11-05', reviewBy: '2027-02-01', note: 'known' },
];

function item(id: number, videoLength: number): LibraryItem {
  return { title: `video ${id}`, videoLength, video_url: `https://deovr.com/deovr/video/id/${id}` };
}

const TODAY = [item(1, 0), item(2, 0), item(3, 249), item(4, 60)];

test.describe('the library duration rule', () => {
  test('the library as it is today passes', () => {
    expect(checkLibraryDurations(TODAY, KNOWN)).toEqual({
      newViolations: [],
      changedKnownIssues: [],
      fixedKnownIssues: [],
    });
  });

  test('a new item with duration 0 is caught', () => {
    const result = checkLibraryDurations([...TODAY, item(5, 0)], KNOWN);
    expect(result.newViolations.map((violation) => violation.id)).toEqual([5]);
  });

  test('a new item with a negative duration is caught', () => {
    const result = checkLibraryDurations([...TODAY, item(6, -5)], KNOWN);
    expect(result.newViolations).toEqual([{ id: 6, title: 'video 6', videoLength: -5 }]);
  });

  test('a known item with another invalid duration is caught', () => {
    const result = checkLibraryDurations([item(1, -1), item(2, 0), item(3, 249)], KNOWN);
    expect(result.changedKnownIssues.map((violation) => violation.id)).toEqual([1]);
    expect(result.fixedKnownIssues).toEqual([]);
  });

  test('a fixed known item is reported, so its exception gets removed', () => {
    const result = checkLibraryDurations([item(1, 120), item(2, 0), item(3, 249)], KNOWN);
    expect(result.fixedKnownIssues.map((issue) => issue.id)).toEqual([1]);
  });

  test('a known item that left the library is reported as fixed', () => {
    const result = checkLibraryDurations([item(2, 0), item(3, 249)], KNOWN);
    expect(result.fixedKnownIssues.map((issue) => issue.id)).toEqual([1]);
  });

  test('an item without a video id in its URL fails loudly', () => {
    const broken = { title: 'broken', videoLength: 0, video_url: 'https://deovr.com/deovr/video/id/' };
    expect(() => checkLibraryDurations([broken], KNOWN)).toThrow('has no video id');
  });

  test('a broken duration is rejected by the contract, and only because of the duration', () => {
    const valid = { ...item(1, 0), thumbnailUrl: 'https://deovr.com/t.jpg' };
    const library = (entry: object): unknown => ({ scenes: [{ name: 'All', list: [entry] }] });
    const { videoLength: _omitted, ...withoutDuration } = valid;
    const errorPaths = (entry: object): string[] => {
      const parsed = librarySchema.safeParse(library(entry));
      return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'));
    };

    expect(librarySchema.safeParse(library(valid)).success, 'The example itself is valid').toBe(true);
    expect(errorPaths(withoutDuration)).toEqual(['scenes.0.list.0.videoLength']);
    expect(errorPaths({ ...valid, videoLength: '0' })).toEqual(['scenes.0.list.0.videoLength']);
  });
});
