import { expect, test } from '@playwright/test';
import { describeSamples, installMediaProbe, mediaState, sampleCurrentTime } from '../../src/media-probe';
import { HomePage } from '../../src/pages/home.page';
import { SearchResultsPage } from '../../src/pages/search-results.page';
import { TIME_TEXT, TIME_TEXT_SELECTOR, VideoPage } from '../../src/pages/video.page';
import { THRESHOLDS, expectGrowth, expectTimeMoves, playerMedia } from '../../src/playback-checks';
import { attachEvidence, describeTest } from '../../src/report';
import { toClock, toSeconds } from '../../src/time';
import { EXPECTED_VIDEO, SEARCH_QUERY } from '../data/video';

test('a visitor finds a video, plays it, pauses and resumes it', async ({ page, isMobile }) => {
  await describeTest({
    feature: 'Search and playback',
    story: 'Find a free video, play, pause and resume it',
    severity: 'critical',
    description:
      'The main path of a visitor: search, open the first result, start the video, pause it and resume it. ' +
      'The playback is proven on the media element of the player (WebGL player, no `<video>` in the DOM) ' +
      'and compared with what the player shows. Scenario: SCENARIO.md.',
    links: [
      { url: 'https://deovr.com/', name: 'Site under test' },
      { url: `https://deovr.com${EXPECTED_VIDEO.path}`, name: 'Video under test' },
    ],
  });
  await installMediaProbe(page);
  const home = new HomePage(page, isMobile);
  const results = new SearchResultsPage(page);
  const video = new VideoPage(page, isMobile);
  const player = video.player;
  const firstCard = results.partsOf(results.firstCard());

  await test.step('1. Open the home page as a visitor', async () => {
    const status = await home.open();
    expect(status, 'The home page must answer with HTTP 200').toBe(200);
    await expect(page, 'The page title must name DeoVR').toHaveTitle(/DeoVR/);
    await expect(home.signInButton, 'A visitor who is not logged in sees "Sign In"').toBeVisible();
  });

  await test.step('2. The search field is visible and enabled', async () => {
    await home.openSearch();
    await expect(home.searchBox, 'Exactly one search field').toHaveCount(1);
    await expect(home.searchBox, 'The search field is visible').toBeVisible();
    await expect(home.searchBox, 'The search field is enabled').toBeEnabled();
  });

  await test.step('3. Click the search field', async () => {
    await home.searchBox.click();
    await expect(home.searchBox, 'The search field has the focus').toBeFocused();
  });

  await test.step(`4. Type "${SEARCH_QUERY}"`, async () => {
    await home.searchBox.fill(SEARCH_QUERY);
    await expect(home.searchBox, 'The search field contains the query').toHaveValue(SEARCH_QUERY);
  }, { params: { query: SEARCH_QUERY } });

  await test.step('5. Press Enter: the search results open', async () => {
    await home.searchBox.press('Enter');
    await expect(page, 'The URL is the search of the query').toHaveURL(
      /\/search\?q=Immersive(%20|\+)Iceland/,
    );
    await expect(results.heading, 'The heading "Search results" is shown').toBeVisible();
    await expect(results.firstCard(), 'The search must return at least one result').toBeVisible();
  });

  await test.step('6. The first result is the expected free video', async () => {
    // Web-first assertions: they retry while the list is still rendering, so a
    // failure here really means that the ranking changed.
    const changed = 'The search ranking changed: update tests/data/video.ts instead of playing another video';
    await expect(firstCard.title, `${changed} (title)`).toHaveText(EXPECTED_VIDEO.title);
    await expect(firstCard.channel, `${changed} (channel)`).toHaveText(EXPECTED_VIDEO.channel);
    await expect(firstCard.duration, `${changed} (duration)`).toHaveText(EXPECTED_VIDEO.duration);
  }, { params: { title: EXPECTED_VIDEO.title, channel: EXPECTED_VIDEO.channel, duration: EXPECTED_VIDEO.duration } });

  await test.step('7. Open the first result: the video page opens', async () => {
    await results.openCard(results.firstCard());
    await expect(page, 'The video page of the expected video opens').toHaveURL(
      `https://deovr.com${EXPECTED_VIDEO.path}`,
    );
  }, { params: { path: EXPECTED_VIDEO.path } });

  await test.step('8. The video page shows the video of the search card', async () => {
    await expect(video.title, 'The heading equals the title of the card').toHaveText(EXPECTED_VIDEO.title);
    await expect(video.channel, 'The channel equals the channel of the card').toHaveText(
      EXPECTED_VIDEO.channel,
    );
  });

  await test.step('9. Start the video: it plays', async () => {
    const budget = THRESHOLDS.startBudgetMs;
    const deadline = Date.now() + budget;
    const remaining = (): number => Math.max(1, deadline - Date.now());
    await player.start();
    // The paywall appears only after the click, so it is checked here and
    // named in the failure. "Switched to Pause" is the state of the button,
    // which exists also while the controls are faded out.
    await expect(
      player.pauseButton.or(video.paywall.heading),
      `Within ${budget} ms of the click the player must switch to "Pause" (or show the paywall)`,
    ).toBeAttached({ timeout: remaining() });
    await expect(
      video.paywall.heading,
      'The video opened the premium paywall: it is not free any more, update tests/data/video.ts',
    ).toBeHidden({ timeout: 1_000 });
    await expect(player.pauseButton, 'The player switched to "Pause"').toBeAttached({ timeout: remaining() });
    await expect
      .poll(async () => (await mediaState(page))?.paused, {
        message: `Within ${budget} ms of the click the media element must be playing`,
        timeout: remaining(),
      })
      .toBe(false);
    await playerMedia(page);
    // A start may buffer: the budget covers it. After that the time has to
    // move steadily for the whole growth window.
    await expectTimeMoves(page, 0, remaining(), 'Step 9');
    const playing = await playerMedia(page);
    await expectGrowth(page, playing.currentTime, 'Step 9');
  }, { params: { ...THRESHOLDS } });

  await test.step('10. The time of the player matches the search card', async () => {
    expect((await player.shownTime()).duration, 'The duration in the player equals the card').toBe(
      EXPECTED_VIDEO.duration,
    );
    const media = await playerMedia(page);
    expect(toClock(media.duration), 'The duration of the media element equals the card').toBe(
      EXPECTED_VIDEO.duration,
    );
    // The shown time is measured inside the page over the window, like
    // currentTime: reads from the test take up to 2 s each on this site, and
    // the player updates the text about once a second, with a lag.
    const samples = await sampleCurrentTime(page, THRESHOLDS.growthWindowMs, {
      textSelector: TIME_TEXT_SELECTOR,
    });
    await attachEvidence('Step 10: time shown by the player', samples);
    const shown = samples.map((sample) => {
      const match = TIME_TEXT.exec(sample.text ?? '');
      return match?.[1] === undefined ? Number.NaN : toSeconds(match[1]);
    });
    const first = shown[0] ?? Number.NaN;
    const last = shown.at(-1) ?? Number.NaN;
    const texts = samples.map((sample) => sample.text?.match(TIME_TEXT)?.[0] ?? String(sample.text)).join(', ');
    expect(first, `The current time of the player must not be 00:00 (shown: ${texts})`).toBeGreaterThan(0);
    expect(
      last,
      `The current time shown by the player must grow within ${THRESHOLDS.growthWindowMs} ms (shown: ${texts})`,
    ).toBeGreaterThan(first);
  }, { params: { duration: EXPECTED_VIDEO.duration } });

  const pausedAt = await test.step('11. Pause: the video stops', async () => {
    await player.pause();
    await expect(player.playButton, 'After the pause the player switched to "Play"').toBeAttached();
    await expect
      .poll(async () => (await mediaState(page))?.paused, { message: 'The media element must be paused' })
      .toBe(true);
    await playerMedia(page);
    const shown = (await player.shownTime()).current;
    const samples = await sampleCurrentTime(page, THRESHOLDS.pauseWindowMs);
    await attachEvidence('Step 11: currentTime samples while paused', samples);
    const times = samples.map((sample) => sample.t);
    const drift = Math.max(...times) - Math.min(...times);
    expect(
      drift,
      `currentTime must not change for ${THRESHOLDS.pauseWindowMs} ms (samples t@time(readyState): ${describeSamples(samples)})`,
    ).toBeLessThanOrEqual(THRESHOLDS.toleranceSeconds);
    expect((await player.shownTime()).current, 'The time shown by the player stays the same').toBe(shown);
    return times[0] ?? Number.NaN;
  }, { params: { pauseWindowMs: THRESHOLDS.pauseWindowMs, toleranceSeconds: THRESHOLDS.toleranceSeconds } });

  await test.step('12. Play: the video continues from the paused position', async () => {
    await player.play();
    await expect(player.pauseButton, 'After play the player switched to "Pause" again').toBeAttached();
    await expect
      .poll(async () => (await mediaState(page))?.paused, { message: 'The media element must play again' })
      .toBe(false);
    await playerMedia(page);
    // A resume may re-buffer: within the resume budget the time has to move on
    // from the paused position. Then the whole window has to stay at or above
    // that position (a restart from 0 a moment later is caught as well).
    await expectTimeMoves(page, pausedAt, THRESHOLDS.resumeBudgetMs, 'Step 12');
    await expectGrowth(page, pausedAt, 'Step 12');
  }, { params: { resumeBudgetMs: THRESHOLDS.resumeBudgetMs, growthWindowMs: THRESHOLDS.growthWindowMs } });
});
