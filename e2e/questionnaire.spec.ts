import { expect, test } from '@playwright/test';

test.describe('ask_user questionnaire', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/questionnaire-e2e.html');
    await expect(page.getByRole('article', { name: 'Structured questionnaire' })).toBeVisible();
  });

  test('step-through one-way trip and submit structured answers', async ({ page }) => {
    await page.getByRole('button', { name: /One-way/i }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('What is the outbound date?')).toBeVisible();
    await page.getByLabel('YYYY-MM-DD').fill('2026-10-31');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('How many passengers')).toBeVisible();
    await expect(page.getByText('inbound/return date')).not.toBeVisible();
    await page.getByLabel('Number of Passengers').fill('2');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect
      .poll(async () => page.evaluate(() => window.__webmcpE2EAnswers))
      .toEqual({
        tripType: 'one-way',
        outboundDate: '2026-10-31',
        passengers: '2',
      });
  });

  test('shows return date step for round-trip', async ({ page }) => {
    await page.getByRole('button', { name: /Round-trip/i }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('YYYY-MM-DD').first().fill('2026-10-31');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('inbound/return date')).toBeVisible();
  });

  test('blocks Next when outbound date is before today', async ({ page }) => {
    await page.getByRole('button', { name: /One-way/i }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('What is the outbound date?')).toBeVisible();
    await page.getByLabel('YYYY-MM-DD').fill('1997-06-01');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('alert')).toContainText('Departure must be today or later.');
    await expect(page.getByText('What is the outbound date?')).toBeVisible();
  });
});
