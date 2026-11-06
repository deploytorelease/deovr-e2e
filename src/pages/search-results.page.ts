import type { Locator, Page } from '@playwright/test';

export interface VideoCard {
  title: string;
  channel: string;
  duration: string;
}

/** The parts of one result card, as locators: assertions on them retry until the card is rendered. */
export interface CardParts {
  title: Locator;
  channel: Locator;
  duration: Locator;
}

export class SearchResultsPage {
  readonly heading: Locator;
  readonly cards: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Search results' });
    // Every result is an <article> inside the result list of the main content.
    this.cards = page.getByRole('main').getByRole('article');
  }

  /** The first result: "first" is the business rule of the scenario, not a fix for strict mode. */
  firstCard(): Locator {
    return this.cards.first();
  }

  partsOf(card: Locator): CardParts {
    return {
      title: card.getByRole('heading', { level: 3 }),
      // Two links point to the channel: the avatar (no text) and the name.
      channel: card.locator('a[href^="/channel/"]', { hasText: /\S/ }),
      // The duration badge is the only text of the card of the form mm:ss.
      duration: card.getByText(/^\d{1,2}:\d{2}(:\d{2})?$/),
    };
  }

  async openCard(card: Locator): Promise<void> {
    await this.partsOf(card).title.click();
  }
}
