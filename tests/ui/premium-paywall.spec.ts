import { expect, test } from '@playwright/test';
import { installMediaProbe, startedDuring } from '../../src/media-probe';
import { HomePage } from '../../src/pages/home.page';
import { VideoPage } from '../../src/pages/video.page';
import { attachEvidence, describeTest } from '../../src/report';
import { PREMIUM_VIDEO } from '../data/video';

/** How long "no video starts" is observed after the paywall opened. */
const NO_PLAYBACK_WINDOW_MS = 3_000;

test('a visitor cannot play a premium video: the paywall opens and no video starts', async ({
  page,
  isMobile,
}) => {
  await describeTest({
    feature: 'Premium content',
    story: 'A visitor gets the paywall instead of a premium video',
    severity: 'critical',
    description:
      'Content protection: a visitor who is not logged in presses play on a premium video. ' +
      'The paywall must open and no media element may start, also not after the paywall is closed. ' +
      'Scenario: SCENARIO.md, "Second scenario".',
    links: [{ url: `https://deovr.com${PREMIUM_VIDEO.path}`, name: 'Premium video under test' }],
  });
  await installMediaProbe(page);
  const header = new HomePage(page, isMobile);
  const video = new VideoPage(page, isMobile);
  const paywall = video.paywall;

  await test.step('1. Open the premium video as a visitor', async () => {
    const status = await video.open(PREMIUM_VIDEO.path);
    expect(status, 'The video page must answer with HTTP 200').toBe(200);
    await expect(header.signInButton, 'A visitor who is not logged in sees "Sign In"').toBeVisible();
    await expect(
      video.title,
      'The page must show the expected premium video: if it shows another one, update tests/data/video.ts',
    ).toHaveText(PREMIUM_VIDEO.title);
    await expect(
      video.premiumPreview,
      'A premium video shows a preview instead of the player: if the player is shown, the video is not premium any more (update tests/data/video.ts)',
    ).toBeVisible();
    await expect(video.player.overlay, 'No player is rendered for premium content').toHaveCount(0);
  }, { params: { path: PREMIUM_VIDEO.path } });

  await test.step('2. Press play on the preview: the paywall opens', async () => {
    if (isMobile) {
      await video.premiumPreview.tap();
    } else {
      await video.premiumPreview.click();
    }
    await expect(paywall.heading, 'The paywall "Unlock DeoVR Premium" must open').toBeVisible();
    await expect(paywall.getPremiumButton, 'The paywall offers "Get Premium"').toBeVisible();
    await expect(paywall.logInButton, 'The paywall offers "Log in"').toBeVisible();
  });

  await test.step('3. No video starts behind the paywall', async () => {
    const started = await startedDuring(page, NO_PLAYBACK_WINDOW_MS);
    await attachEvidence('Step 3: media elements started', { windowMs: NO_PLAYBACK_WINDOW_MS, started });
    expect(
      started,
      `A premium video must not start for a visitor: ${started} media element(s) started within ${NO_PLAYBACK_WINDOW_MS} ms`,
    ).toBe(0);
  }, { params: { windowMs: NO_PLAYBACK_WINDOW_MS } });

  await test.step('4. Close the paywall: it closes and still no video starts', async () => {
    await paywall.closeButton.click();
    await expect(paywall.heading, 'The paywall must close').toBeHidden();
    const started = await startedDuring(page, NO_PLAYBACK_WINDOW_MS);
    expect(
      started,
      `Closing the paywall must not start the premium video: ${started} media element(s) started`,
    ).toBe(0);
  });
});
