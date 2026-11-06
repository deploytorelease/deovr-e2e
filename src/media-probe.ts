import type { Page } from '@playwright/test';

/**
 * Observation of the media element of the DeoVR player.
 *
 * The player draws the frames on a WebGL canvas and never attaches its
 * `<video>` element to the document, so `page.locator('video')` finds
 * nothing. Before any script of the page runs, the probe wraps
 * `HTMLMediaElement.prototype.play` and keeps a reference to every element
 * that is started. The wrapper only observes: it calls the original `play` on
 * the same element (`play()` takes no arguments) and returns its promise
 * unchanged.
 *
 * The probe keeps every started element, in the order of the start. The test
 * asserts that exactly one element was started (see `MediaState.started`): a
 * second element (an ad, a preview) would otherwise be read as "the video".
 */

declare global {
  interface Window {
    __qaMedia?: HTMLMediaElement[];
  }
}

export interface MediaState {
  /** How many media elements the page has started. */
  started: number;
  /** The source of the first started element. */
  source: string;
  paused: boolean;
  currentTime: number;
  duration: number;
}

/** Installs the probe. Call it before the first navigation. */
export async function installMediaProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const started: HTMLMediaElement[] = [];
    Object.defineProperty(window, '__qaMedia', { value: started });
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      if (!started.includes(this)) {
        started.push(this);
      }
      return originalPlay.call(this);
    };
  });
}

/** The state of the first started media element, or null before any playback. */
export async function mediaState(page: Page): Promise<MediaState | null> {
  return page.evaluate(() => {
    const started = window.__qaMedia ?? [];
    const media = started[0];
    if (media === undefined) {
      return null;
    }
    return {
      started: started.length,
      source: media.currentSrc || media.src,
      paused: media.paused,
      currentTime: media.currentTime,
      duration: media.duration,
    };
  });
}

/** One measurement: the media time, the page time and the buffer state. */
export interface MediaSample {
  /** `currentTime` of the media, in seconds. */
  t: number;
  /** Milliseconds since the start of the window, measured in the page. */
  at: number;
  /** `readyState` of the media: below 3 the browser has not enough data to play on. */
  readyState: number;
  /** The text of `textSelector` at the same moment, when one was given. */
  text: string | null;
}

/** A compact form of samples for failure messages: `t@at(readyState)`. */
export function describeSamples(samples: readonly MediaSample[]): string {
  return samples.map((sample) => `${sample.t.toFixed(2)}@${Math.round(sample.at)}ms(rs${sample.readyState})`).join(', ');
}

/**
 * Samples `currentTime` of the first started element inside the page.
 *
 * "The video stays paused" and "the time grows by 1 s within 3 s" can only be
 * proven over a period of time. The window is measured in the browser, so the
 * test needs no hard wait. A missing element is reported, not sampled as NaN.
 */
export async function sampleCurrentTime(
  page: Page,
  windowMs: number,
  options: { intervalMs?: number; textSelector?: string } = {},
): Promise<MediaSample[]> {
  return page.evaluate(
    ({ windowMs: total, intervalMs: step, textSelector }) =>
      new Promise<{ t: number; at: number; readyState: number; text: string | null }[]>((resolve, reject) => {
        const media = (window.__qaMedia ?? [])[0];
        if (media === undefined) {
          reject(new Error('No media element was started: there is nothing to sample'));
          return;
        }
        const samples: { t: number; at: number; readyState: number; text: string | null }[] = [];
        const started = performance.now();
        const tick = (): void => {
          samples.push({
            t: media.currentTime,
            at: performance.now() - started,
            readyState: media.readyState,
            text: textSelector === null ? null : (document.querySelector(textSelector)?.textContent ?? null),
          });
          if (performance.now() - started >= total) {
            resolve(samples);
            return;
          }
          setTimeout(tick, step);
        };
        tick();
      }),
    { windowMs, intervalMs: options.intervalMs ?? 250, textSelector: options.textSelector ?? null },
  );
}

/**
 * How many media elements the page starts during a time window.
 *
 * "No video starts" can only be proven over a period of time; the window is
 * measured in the browser, like the samples above.
 */
export async function startedDuring(page: Page, windowMs: number): Promise<number> {
  return page.evaluate(
    (total) =>
      new Promise<number>((resolve) => {
        setTimeout(() => resolve((window.__qaMedia ?? []).length), total);
      }),
    windowMs,
  );
}

/**
 * Samples the first started media element until its time has moved past
 * `from`, or until `budgetMs` is over. The samples are returned either way,
 * so a stall can be told apart: `readyState` below 3 means the browser waits
 * for data (network), 3 or 4 with a standing time means it has data and does
 * not play on (player or browser).
 */
export async function sampleUntilMoved(
  page: Page,
  from: number,
  budgetMs: number,
  intervalMs = 250,
): Promise<{ moved: boolean; samples: MediaSample[] }> {
  return page.evaluate(
    ({ from: start, budgetMs: total, intervalMs: step }) =>
      new Promise<{ moved: boolean; samples: { t: number; at: number; readyState: number; text: string | null }[] }>(
        (resolve) => {
          const media = (window.__qaMedia ?? [])[0];
          const samples: { t: number; at: number; readyState: number; text: string | null }[] = [];
          const started = performance.now();
          const tick = (): void => {
            const t = media?.currentTime ?? Number.NaN;
            samples.push({ t, at: performance.now() - started, readyState: media?.readyState ?? -1, text: null });
            if (t > start + 0.05) {
              resolve({ moved: true, samples });
              return;
            }
            if (performance.now() - started >= total) {
              resolve({ moved: false, samples });
              return;
            }
            setTimeout(tick, step);
          };
          tick();
        },
      ),
    { from, budgetMs, intervalMs },
  );
}
