import { expect, test } from '@playwright/test';
import { PricingPage, type Plan } from '../../src/pages/pricing.page';
import { attachEvidence, describeTest } from '../../src/report';

/**
 * The premium plans are checked by calculation, never against fixed prices:
 * prices, discounts and the currency change (sales, regions), the arithmetic
 * between them must not. Nothing in this file names an amount or a currency.
 */

/** Half a cent per month: a per-month price shown rounded to cents. */
const CENT_ROUNDING = 0.005;

/** The shown discount, rounded down or to the nearest: the site does not publish its rounding rule. */
function expectedBadges(plan: Plan): number[] {
  const exact = (1 - plan.price.amount / plan.listPrice.amount) * 100;
  return [...new Set([Math.floor(exact), Math.round(exact)])];
}

/** How many periods the "Billed as" amount covers, e.g. 12 months for an annual plan. */
function periodsBilled(plan: Plan): number {
  return plan.billedAs === null ? 1 : Math.round(plan.billedAs.amount / plan.price.amount);
}

/** What the checkout must charge for a plan. */
function charged(plan: Plan): number {
  return plan.billedAs?.amount ?? plan.price.amount;
}

test('the premium plans calculate their discounts and totals correctly', async ({ page, isMobile }) => {
  await describeTest({
    feature: 'Premium plans',
    story: 'Prices, discounts and the checkout total are consistent',
    severity: 'critical',
    description:
      'The plans of `/join` are read from the page and checked by calculation: the discount badge against the ' +
      'list and the sale price, an annual price against its monthly price, the checkout total against the ' +
      'chosen plan, one currency everywhere. No price is written in the test, so a new sale or another ' +
      'currency does not break it; a wrong calculation does.',
    links: [{ url: 'https://deovr.com/join', name: 'Premium plans' }],
  });
  const pricing = new PricingPage(page, isMobile);

  const plans = await test.step('1. Open the plans and read them', async () => {
    expect(await pricing.open(), 'The plans page must answer with HTTP 200').toBe(200);
    await expect(pricing.items.first(), 'The page shows the premium plans').toBeVisible();
    const read = await pricing.readPlans();
    await attachEvidence('The plans as read from the page', read);
    expect(read.length, 'There is more than one plan to choose from').toBeGreaterThan(1);
    return read;
  });

  await test.step('2. One currency for every price', async () => {
    const currencies = new Set(
      plans.flatMap((plan) => [plan.listPrice, plan.price, ...(plan.billedAs ? [plan.billedAs] : [])].map((m) => m.currency)),
    );
    expect([...currencies], 'All prices use the same currency').toHaveLength(1);
  });

  for (const plan of plans) {
    await test.step(`3. "${plan.name}": the discount matches the prices`, () => {
      expect(plan.price.amount, `${plan.name}: the sale price is below the list price`).toBeLessThan(
        plan.listPrice.amount,
      );
      const exact = ((1 - plan.price.amount / plan.listPrice.amount) * 100).toFixed(2);
      expect(
        expectedBadges(plan),
        `${plan.name}: the badge -${plan.badgePercent}% must equal 1 - ${plan.price.text} / ${plan.listPrice.text} = ${exact}% (rounded)`,
      ).toContain(plan.badgePercent);
    }, { params: { list: plan.listPrice.text, price: plan.price.text, badge: `-${plan.badgePercent}%` } });

    if (plan.billedAs !== null) {
      const billed = plan.billedAs;
      await test.step(`4. "${plan.name}": the billed amount equals the price per ${plan.period} times the periods`, () => {
        const periods = periodsBilled(plan);
        expect(periods, `${plan.name}: "${billed.text}" covers more than one ${plan.period}`).toBeGreaterThan(1);
        expect(
          Math.abs(billed.amount - periods * plan.price.amount),
          `${plan.name}: ${billed.text} must equal ${periods} × ${plan.price.text} (up to the rounding of the ${plan.period} price to cents)`,
        ).toBeLessThanOrEqual(periods * CENT_ROUNDING + 1e-9);
      }, { params: { billed: billed.text, price: plan.price.text } });
    }
  }

  for (const plan of plans) {
    await test.step(`5. Choose "${plan.name}": the checkout charges this plan`, async () => {
      await pricing.select(plan);
      await expect
        .poll(async () => (await pricing.readPlans()).filter((p) => p.selected).map((p) => p.name), {
          message: `After the choice exactly "${plan.name}" is selected`,
        })
        .toEqual([plan.name]);
      const summary = await pricing.readSummary();
      await attachEvidence(`Checkout for "${plan.name}"`, summary);
      expect(summary.total.currency, 'The checkout uses the currency of the plans').toBe(plan.price.currency);
      expect(
        summary.total.amount,
        `The checkout total must be what "${plan.name}" charges: ${plan.billedAs?.text ?? plan.price.text}`,
      ).toBeCloseTo(charged(plan), 2);
      if (plan.period === 'once') {
        expect(summary.text, 'A one-time plan says so').toMatch(/one-time/i);
      } else {
        const cycle = periodsBilled(plan) === 12 ? 'year' : plan.period;
        expect(summary.text, `A recurring plan states its amount and cycle`).toContain(
          `Rebills at ${summary.total.text} every ${cycle}`,
        );
      }
    });
  }
});
