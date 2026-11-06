import type { Locator, Page } from '@playwright/test';
import { openPage } from './navigation';

/** An amount of money as shown on the page. */
export interface Money {
  /** The currency symbol as shown, e.g. `$`, `€`, `£`. */
  currency: string;
  amount: number;
  text: string;
}

/** One plan, as read from the page; nothing about it is known in advance. */
export interface Plan {
  name: string;
  /** The crossed out price. */
  listPrice: Money;
  /** The price the plan is sold for, per `period`. */
  price: Money;
  /** The text after the price: `month`, `once`, ... */
  period: string;
  /** The discount badge as a positive number: `-56%` → 56. */
  badgePercent: number;
  /** "Billed as $83.88": the amount charged per billing period, when it differs from `price`. */
  billedAs: Money | null;
  /** `Selected` instead of `Select`: the plan in the checkout. */
  selected: boolean;
}

/** The checkout summary under the plans. */
export interface Summary {
  total: Money;
  /** "total cost (VAT included). Rebills at $83.88 every year until canceled." */
  text: string;
}

/** A currency symbol before or after the number: `$15.99`, `15,99 €`. */
const MONEY = /(\p{Sc})\s?(\d[\d.,]*)|(\d[\d.,]*)\s?(\p{Sc})/u;

export function parseMoney(text: string): Money | null {
  const match = MONEY.exec(text);
  if (match === null) {
    return null;
  }
  const currency = match[1] ?? match[4] ?? '';
  const raw = match[2] ?? match[3] ?? '';
  // "1,299.99" → 1299.99; "14,99" → 14.99.
  const normalized = raw.includes('.') ? raw.replaceAll(',', '') : raw.replace(',', '.');
  return { currency, amount: Number(normalized), text: match[0] };
}

/**
 * The premium plans page `/join`.
 *
 * The plans are a list of labels without a role: there is no radio group, and
 * the chosen plan differs from the others only by the text `Selected` instead
 * of `Select` (an accessibility finding). The plans are therefore read as text
 * inside the page, and the crossed out price is found by its computed style.
 */
export class PricingPage {
  readonly plans: Locator;
  readonly items: Locator;

  constructor(
    private readonly page: Page,
    private readonly isMobile: boolean,
  ) {
    this.plans = page.getByRole('list').filter({ has: page.getByText(/^Select(ed)?$/) });
    this.items = this.plans.getByRole('listitem');
  }

  async open(): Promise<number | undefined> {
    return openPage(this.page, '/join');
  }

  /** The visible texts of every plan, in order, with the crossed out ones marked. */
  async #rawPlans(): Promise<{ texts: string[]; struck: string[] }[]> {
    return this.items.evaluateAll((items) =>
      items.map((item) => {
        const leaves = [...item.querySelectorAll('*')].filter(
          (element) => element.children.length === 0 && (element.textContent ?? '').trim() !== '',
        );
        const struck = leaves.filter((element) =>
          getComputedStyle(element).textDecorationLine.includes('line-through'),
        );
        return {
          texts: leaves.map((element) => (element.textContent ?? '').trim()),
          struck: struck.map((element) => (element.textContent ?? '').trim()),
        };
      }),
    );
  }

  async readPlans(): Promise<Plan[]> {
    const raw = await this.#rawPlans();
    return raw.map(({ texts, struck }, index) => {
      const fail = (what: string): never => {
        throw new Error(`Plan ${index + 1} (${texts.join(' | ')}): ${what}`);
      };
      const listPrice = parseMoney(struck[0] ?? '') ?? fail('no crossed out list price');
      const billedText = texts.find((text) => /^Billed as/i.test(text));
      const priceText =
        texts.find((text) => parseMoney(text) !== null && !struck.includes(text) && text !== billedText) ??
        fail('no price');
      const periodText = texts.find((text) => /^\/\s*\S+/.test(text)) ?? fail('no period ("/ month")');
      const badge = texts.find((text) => /^-\d+%$/.test(text)) ?? fail('no discount badge ("-56%")');
      return {
        name: texts[0] ?? fail('no name'),
        listPrice,
        price: parseMoney(priceText) ?? fail('no price'),
        period: periodText.replace(/^\/\s*/, ''),
        badgePercent: Number(badge.slice(1, -1)),
        billedAs: billedText === undefined ? null : parseMoney(billedText),
        selected: texts.includes('Selected'),
      };
    });
  }

  async select(plan: Plan): Promise<void> {
    const item = this.items.filter({ hasText: plan.name });
    if (this.isMobile) {
      await item.tap();
    } else {
      await item.click();
    }
  }

  /** The checkout summary: the amount next to "total cost" and its explanation. */
  async readSummary(): Promise<Summary> {
    const found = await this.page.evaluate(() => {
      const explanation = [...document.querySelectorAll('p')].find((p) => /total cost/i.test(p.textContent ?? ''));
      return explanation === undefined
        ? null
        : { amount: explanation.previousElementSibling?.textContent ?? '', text: explanation.textContent ?? '' };
    });
    const total = found === null ? null : parseMoney(found.amount);
    if (found === null || total === null) {
      throw new Error('The checkout shows no "total cost"');
    }
    return { total, text: found.text.trim() };
  }
}
