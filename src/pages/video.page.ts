import { expect, type Locator, type Page } from '@playwright/test';
import { toSeconds } from '../time';
import { openPage } from './navigation';

/**
 * Locators without a role, a name or a `data-testid`.
 *
 * The player has `data-testid` attributes (`player-overlay`, `first-play-btn`,
 * `bottom-controls`, ...) and the test uses them. Two parts have none: the
 * play/pause button of the phone layout (it differs from the forward button
 * only by its icon in the SVG sprite) and the block with the title and the
 * channel of the video. They use the icon id or a stable part of the
 * CSS-module class name, without the build hash: the last option of the
 * locator policy.
 */
const NO_TEST_ID = {
  mobileControl: (icon: 'play' | 'pause') =>
    `[class*="mobilePlayControls"] button:has(use[href$="#${icon}"])`,
  /** The title and the channel of the video, not of the related videos. */
  videoInfo: '[class*="videoInfoSection"]',
} as const;

/** The CSS form of the time line, for measurements inside the page. */
export const TIME_TEXT_SELECTOR = '[data-testid="player-overlay"] [data-testid="bottom-controls"]';

/** `00:13/04:09`, followed by `1080p` on a desktop. */
export const TIME_TEXT = /(\d{1,2}:\d{2}(?::\d{2})?)\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/;

/**
 * The player of a video page.
 *
 * The desktop and the phone layout have different controls: on a desktop the
 * buttons have a `title` (`Pause`, `Play`), on a phone they have no name at
 * all and are found by their icon. The player hides its controls about two to
 * four seconds after the last interaction and says so in the attribute
 * `data-ui-hidden` of the overlay.
 */
export class PlayerComponent {
  /** The surface of the player: the video and the controls on top of it. */
  readonly overlay: Locator;
  readonly startButton: Locator;
  readonly pauseButton: Locator;
  readonly playButton: Locator;
  /** The time line of the controls: `current/duration`. */
  readonly timeText: Locator;

  constructor(
    private readonly page: Page,
    private readonly isMobile: boolean,
  ) {
    this.overlay = page.getByTestId('player-overlay');
    this.timeText = this.overlay.getByTestId('bottom-controls');
    if (isMobile) {
      this.playButton = this.overlay.locator(NO_TEST_ID.mobileControl('play'));
      this.pauseButton = this.overlay.locator(NO_TEST_ID.mobileControl('pause'));
      // On a phone the first start is the same play button.
      this.startButton = this.playButton;
    } else {
      this.startButton = this.overlay.getByTestId('first-play-btn');
      // `exact`: the player also has a "Play in VR" button. `includeHidden`:
      // the state of the button (Pause or Play) is checked also while the
      // controls are hidden with `visibility`, which removes them from the
      // accessibility tree.
      this.pauseButton = this.overlay.getByRole('button', { name: 'Pause', exact: true, includeHidden: true });
      this.playButton = this.overlay.getByRole('button', { name: 'Play', exact: true, includeHidden: true });
    }
  }

  #nudge = 0;

  async #expectControls(shown: boolean, message: string, timeout?: number): Promise<void> {
    await expect(this.overlay, message).toHaveAttribute('data-ui-hidden', shown ? 'false' : 'true', {
      ...(timeout === undefined ? {} : { timeout }),
    });
  }

  /**
   * A point on the bare video, away from every control.
   *
   * On a phone the top left corner of the player is the "Play in VR" button,
   * so a fixed offset like (40, 40) would press it. 15 % of the width, in the
   * middle of the height, is the bare video on every layout of the test. The
   * point is checked before it is used: if a control lies there, the test
   * fails with the name of that control instead of pressing it.
   */
  async #freePoint(): Promise<{ x: number; y: number }> {
    this.#nudge = (this.#nudge + 1) % 2;
    const point = await this.overlay.evaluate((overlay, nudge) => {
      const box = overlay.getBoundingClientRect();
      const x = box.width * 0.15;
      const y = box.height * (0.5 + nudge * 0.1);
      const hit = document.elementFromPoint(box.left + x, box.top + y);
      const control = hit?.closest('button, a, input, [role="button"]');
      return {
        x,
        y,
        control:
          control === null || control === undefined
            ? null
            : control.getAttribute('title') ||
              control.getAttribute('aria-label') ||
              control.textContent?.trim() ||
              control.outerHTML.slice(0, 80),
      };
    }, this.#nudge);
    expect(
      point.control,
      `The touch point (${Math.round(point.x)}, ${Math.round(point.y)}) of the player lies on a control`,
    ).toBeNull();
    return { x: point.x, y: point.y };
  }

  /**
   * Desktop: moves the mouse onto the button, which shows the controls and
   * restarts their timer, and clicks it right away, as a person does.
   *
   * Phone: a tap toggles the controls (a tap on shown controls hides them),
   * and the test cannot know how much time shown controls have left. It waits
   * until they hide, shows them with one tap on the bare video and presses at
   * once, inside a fresh timer.
   */
  async #pressControl(button: Locator): Promise<void> {
    if (this.isMobile) {
      await this.#expectControls(false, 'The controls of the player must hide by themselves', 10_000);
      await this.overlay.tap({ position: await this.#freePoint() });
      await this.#expectControls(true, 'A tap on the video must show the controls');
      await button.tap();
      return;
    }
    const box = await button.boundingBox();
    if (box === null) {
      throw new Error('The button of the player is not rendered: there is nothing to move the mouse to');
    }
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.#expectControls(true, 'Moving the mouse over the player must show the controls');
    await button.click();
  }

  async start(): Promise<void> {
    if (this.isMobile) {
      await this.startButton.tap();
    } else {
      await this.startButton.click();
    }
  }

  async pause(): Promise<void> {
    await this.#pressControl(this.pauseButton);
  }

  async play(): Promise<void> {
    await this.#pressControl(this.playButton);
  }

  /**
   * The current time and the duration shown by the player, in seconds and as text.
   *
   * Read without touching the player: the text is the one the player renders,
   * also while the controls are hidden, and a read must not toggle them.
   */
  async shownTime(): Promise<{ current: number; duration: string }> {
    const text = (await this.timeText.textContent()) ?? '';
    const match = TIME_TEXT.exec(text);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`The player shows no time of the form mm:ss/mm:ss: "${text}"`);
    }
    return { current: toSeconds(match[1]), duration: match[2] };
  }
}

/**
 * The paywall of premium content.
 *
 * The page renders two nested dialogs (`<dialog>` and `<section role="dialog">`),
 * so `getByRole('dialog')` matches both. The heading is unique; the buttons
 * are looked up inside the inner dialog, because a phone also shows a
 * "Get Premium" bar at the bottom of every page.
 */
export class Paywall {
  readonly heading: Locator;
  readonly dialog: Locator;
  readonly getPremiumButton: Locator;
  readonly logInButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Unlock DeoVR Premium' });
    this.dialog = page.locator('section[role="dialog"]').filter({ has: this.heading });
    this.getPremiumButton = this.dialog.getByRole('button', { name: 'Get Premium', exact: true });
    this.logInButton = this.dialog.getByRole('button', { name: 'Log in', exact: true });
    this.closeButton = this.dialog.getByRole('button', { name: 'Close', exact: true });
  }
}

export class VideoPage {
  readonly title: Locator;
  readonly channel: Locator;
  readonly paywall: Paywall;
  readonly player: PlayerComponent;
  /**
   * The preview of a premium video: instead of the player the page shows a
   * preview image as one button ("video preview Play in VR"); a click on it
   * opens the paywall.
   */
  readonly premiumPreview: Locator;

  constructor(
    private readonly page: Page,
    isMobile: boolean,
  ) {
    const info = page.locator(NO_TEST_ID.videoInfo);
    this.title = info.getByRole('heading', { level: 1 });
    this.channel = info.locator('a[href^="/channel/"]', { hasText: /\S/ });
    this.paywall = new Paywall(page);
    this.player = new PlayerComponent(page, isMobile);
    this.premiumPreview = page.getByRole('button', { name: /^video preview/ });
  }

  async open(path: string): Promise<number | undefined> {
    return openPage(this.page, path);
  }
}
