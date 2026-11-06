/**
 * The rule "every video of the library has a positive duration", with
 * exceptions for known bad items.
 *
 * Pure logic without network, so the rule itself can be tested with made-up
 * libraries (`tests/api/library-durations.spec.ts`).
 */

export interface LibraryItem {
  title: string;
  videoLength: number;
  video_url: string;
}

/** A known item that is allowed to break the rule, and only in the known way. */
export interface KnownDurationIssue {
  id: number;
  /** The only value tolerated for this item. */
  videoLength: number;
  reportedOn: string;
  /** After this date the exception has to be reviewed. */
  reviewBy: string;
  note: string;
}

export interface DurationViolation {
  id: number;
  title: string;
  videoLength: number;
}

export interface DurationCheck {
  /** Items without a positive duration that are not a known issue. */
  newViolations: DurationViolation[];
  /** Known items that break the rule in another way than the known one. */
  changedKnownIssues: DurationViolation[];
  /** Known items that are fixed now (or gone): their exception has to be removed. */
  fixedKnownIssues: KnownDurationIssue[];
}

/** The id at the end of `https://deovr.com/deovr/video/id/<id>`. */
export function libraryItemId(item: Pick<LibraryItem, 'video_url'>): number {
  const id = Number(item.video_url.split('/').at(-1));
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`The library item has no video id in its URL: ${item.video_url}`);
  }
  return id;
}

export function checkLibraryDurations(
  items: readonly LibraryItem[],
  knownIssues: readonly KnownDurationIssue[],
): DurationCheck {
  const knownById = new Map(knownIssues.map((issue) => [issue.id, issue]));
  const stillBroken = new Set<number>();
  const newViolations: DurationViolation[] = [];
  const changedKnownIssues: DurationViolation[] = [];

  for (const item of items) {
    if (item.videoLength > 0) {
      continue;
    }
    const violation = { id: libraryItemId(item), title: item.title, videoLength: item.videoLength };
    const known = knownById.get(violation.id);
    if (known === undefined) {
      newViolations.push(violation);
    } else if (known.videoLength === item.videoLength) {
      stillBroken.add(violation.id);
    } else {
      changedKnownIssues.push(violation);
    }
  }

  const changedIds = new Set(changedKnownIssues.map((violation) => violation.id));
  const fixedKnownIssues = knownIssues.filter((issue) => !stillBroken.has(issue.id) && !changedIds.has(issue.id));
  return { newViolations, changedKnownIssues, fixedKnownIssues };
}
