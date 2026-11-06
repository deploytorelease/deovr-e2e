import type { Locator, Page } from '@playwright/test';
import { openPage } from './navigation';

export class HomePage {
  readonly signInButton: Locator;
  readonly searchButton: Locator;
  readonly searchBox: Locator;

  /** `isMobile` comes from the Playwright project: the header differs between the layouts. */
  constructor(
    private readonly page: Page,
    private readonly isMobile: boolean,
  ) {
    const header = page.getByRole('banner');
    // On a phone the label of the button is a <span> with `display: none`, so
    // the button has no accessible name (an accessibility finding). The button
    // is found by the text it contains instead.
    this.signInButton = isMobile
      ? header.locator('button', { hasText: 'Sign In' })
      : header.getByRole('button', { name: 'Sign In', exact: true });
    // On a phone the search field is hidden behind this button.
    this.searchButton = header.getByRole('button', { name: 'Search', exact: true });
    // The search field has no label; its placeholder is its accessible name.
    this.searchBox = page.getByPlaceholder("I'm looking for...");
  }

  async open(): Promise<number | undefined> {
    return openPage(this.page, '/');
  }

  /** Makes the search field reachable: on a phone it has to be opened first. */
  async openSearch(): Promise<void> {
    if (this.isMobile) {
      await this.searchButton.click();
    }
  }
}
