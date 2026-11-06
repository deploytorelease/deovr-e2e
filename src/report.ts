import { test } from '@playwright/test';
import * as allure from 'allure-js-commons';

/**
 * The metadata of a test in the Allure report.
 *
 * Epic → feature → story is the "Behaviors" tree of the report; the severity,
 * the description and the links tell a reader what the test protects and
 * where its scenario is written down.
 */
export async function describeTest(meta: {
  feature: string;
  story: string;
  severity: 'blocker' | 'critical' | 'normal' | 'minor' | 'trivial';
  description: string;
  links: { url: string; name: string }[];
}): Promise<void> {
  await allure.epic('DeoVR web: watching a video');
  await allure.feature(meta.feature);
  await allure.story(meta.story);
  await allure.severity(meta.severity);
  await allure.description(meta.description);
  for (const link of meta.links) {
    await allure.link(link.url, link.name);
  }
}

/**
 * Attaches the evidence of a check (samples, states) as JSON.
 *
 * The attachment is written for passed checks as well: the report shows the
 * numbers a check was decided on, not only that it passed.
 */
export async function attachEvidence(name: string, data: unknown): Promise<void> {
  await allure.attachment(name, JSON.stringify(data, null, 2), 'application/json');
}

/**
 * Marks a test that passed despite a problem of the live site, so the problem
 * stays visible instead of hidden by the pass: an annotation in the Playwright
 * report, a tag and the evidence in Allure.
 */
async function reportWarning(tag: string, description: string, evidence: unknown): Promise<void> {
  test.info().annotations.push({ type: 'warning', description });
  await allure.tag(tag);
  await attachEvidence(`WARNING: ${description}`, evidence);
}

/** A playback stall that recovered within the stall grace. */
export async function reportRecoveredStall(description: string, samples: unknown): Promise<void> {
  await reportWarning('playback-stall', description, samples);
}

/** A page whose `load` event did not come within the load grace. */
export async function reportSlowPageLoad(description: string, pendingRequests: unknown): Promise<void> {
  await reportWarning('slow-page-load', description, pendingRequests);
}
