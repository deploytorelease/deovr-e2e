import { expect, type Page } from '@playwright/test';
import {
  describeSamples,
  mediaState,
  sampleCurrentTime,
  sampleUntilMoved,
  type MediaSample,
  type MediaState,
} from './media-probe';
import { attachEvidence, reportRecoveredStall } from './report';

/** The thresholds of SCENARIO.md, steps 9–12. Change them there first. */
export const THRESHOLDS = {
  /** From the click on the start button until the time of the video moves (buffering included). */
  startBudgetMs: 15_000,
  /** From the click on Play until the time moves on from the paused position (re-buffering included). */
  resumeBudgetMs: 5_000,
  /** Once the time moves, it has to grow ... */
  growthWindowMs: 3_000,
  /** ... by at least this much within the window. */
  minGrowthSeconds: 1,
  /** After a pause currentTime must not change for this long ... */
  pauseWindowMs: 2_000,
  /** ... by more than this. */
  toleranceSeconds: 0.25,
  /**
   * A stall on the live site (network, CDN, WebKit) that recovers within this
   * grace passes with a warning in the report; a player that does not recover
   * fails. A broken player never recovers, so it is still caught.
   */
  stallGraceMs: 10_000,
} as const;

/** The media of the player is served from this CDN; anything else (an ad, a preview) is not the video. */
const PLAYER_MEDIA_SOURCE = 'https://cdn-vr.deovr.com/';

/** The state of the media element of the player; fails when it is not exactly the player's element. */
export async function playerMedia(page: Page): Promise<MediaState> {
  const state = await mediaState(page);
  expect(state, 'The player must have started a media element').not.toBeNull();
  const media = state as MediaState;
  expect(
    media.started,
    'Exactly one media element must have been started: another one (an ad, a preview) would make the checks read the wrong element',
  ).toBe(1);
  expect(media.source, 'The started media element must be the video of the player').toContain(
    PLAYER_MEDIA_SOURCE,
  );
  return media;
}

/**
 * Waits until the time of the video moves past `from` within `budgetMs`.
 *
 * "Playing" for a user means that the picture moves, not that the element is
 * no longer paused: a stalled start (`paused: false`, `currentTime` 0) is
 * given the stall grace on top of the budget and fails, with its own message,
 * when it does not recover.
 */
export async function expectTimeMoves(
  page: Page,
  from: number,
  budgetMs: number,
  what: string,
): Promise<void> {
  const { moved, samples } = await sampleUntilMoved(page, from, budgetMs);
  if (moved) {
    return;
  }
  const recovered = await recoversFromStall(page, from, what, samples);
  expect(
    recovered,
    `${what}: the time of the video must move past ${from.toFixed(2)} s within ${budgetMs} ms + ${THRESHOLDS.stallGraceMs} ms of stall grace (a stalled playback; samples t@time(readyState): ${describeSamples(samples.slice(-6))})`,
  ).toBe(true);
}

/**
 * Samples currentTime for the growth window and checks that it grows by at
 * least `minGrowthSeconds` and never drops below `notBelow`.
 *
 * A window that grows too little is a stall: it is given the stall grace and
 * then measured once more, strictly. A drop below `notBelow` (a restart) is
 * never excused.
 */
export async function expectGrowth(page: Page, notBelow: number, what: string): Promise<void> {
  const firstWindow = await measureGrowthWindow(page, notBelow, what);
  if (firstWindow.growth >= THRESHOLDS.minGrowthSeconds) {
    return;
  }
  const recovered = await recoversFromStall(page, firstWindow.lastTime, what, firstWindow.samples);
  expect(
    recovered,
    `${what}: currentTime must grow by at least ${THRESHOLDS.minGrowthSeconds} s within ${THRESHOLDS.growthWindowMs} ms, and did not move on within ${THRESHOLDS.stallGraceMs} ms of stall grace (samples t@time(readyState): ${describeSamples(firstWindow.samples)})`,
  ).toBe(true);
  const secondWindow = await measureGrowthWindow(page, notBelow, `${what} (after the stall)`);
  expect(
    secondWindow.growth,
    `${what}: currentTime must grow by at least ${THRESHOLDS.minGrowthSeconds} s within ${THRESHOLDS.growthWindowMs} ms after the stall (samples t@time(readyState): ${describeSamples(secondWindow.samples)})`,
  ).toBeGreaterThanOrEqual(THRESHOLDS.minGrowthSeconds);
}

/** One growth window: fails at once on a drop below `notBelow`, returns the growth. */
async function measureGrowthWindow(
  page: Page,
  notBelow: number,
  what: string,
): Promise<{ growth: number; lastTime: number; samples: MediaSample[] }> {
  const samples = await sampleCurrentTime(page, THRESHOLDS.growthWindowMs);
  await attachEvidence(`${what}: currentTime samples`, samples);
  const times = samples.map((sample) => sample.t);
  expect(
    Math.min(...times),
    `${what}: currentTime must never drop below ${notBelow.toFixed(2)} s (samples t@time(readyState): ${describeSamples(samples)})`,
  ).toBeGreaterThanOrEqual(notBelow - THRESHOLDS.toleranceSeconds);
  const firstTime = times[0] ?? Number.NaN;
  const lastTime = times.at(-1) ?? Number.NaN;
  return { growth: lastTime - firstTime, lastTime, samples };
}

/**
 * Gives a stalled video the stall grace to move past `from`. A recovery is
 * reported as a warning with the samples of the stall; the caller fails when
 * there is none.
 */
async function recoversFromStall(
  page: Page,
  from: number,
  what: string,
  stallSamples: readonly MediaSample[],
): Promise<boolean> {
  const grace = await sampleUntilMoved(page, from, THRESHOLDS.stallGraceMs);
  const samples = [...stallSamples, ...grace.samples];
  if (grace.moved) {
    const stalledMs = Math.round(grace.samples.at(-1)?.at ?? 0);
    await reportRecoveredStall(`${what}: the video stalled at ${from.toFixed(2)} s and moved on after ${stalledMs} ms of grace`, samples);
  } else {
    await attachEvidence(`${what}: samples of the stalled playback`, samples);
  }
  return grace.moved;
}
