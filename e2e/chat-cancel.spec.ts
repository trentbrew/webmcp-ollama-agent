import { expect, test } from '@playwright/test';

test.describe('chat cancel / stop button', () => {
  test('stop during streaming returns composer to send state', async ({ page }) => {
    await page.goto('/chat-cancel-e2e.html?mode=streaming');

    await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();

    await page.getByRole('button', { name: 'Stop response' }).click();

    await expect.poll(async () => page.evaluate(() => window.__webmcpE2EChatStatus?.())).toBe('ready');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop response' })).toHaveCount(0);
  });

  test('stop during awaiting-input marks questionnaire skipped and clears dock', async ({ page }) => {
    await page.goto('/chat-cancel-e2e.html?mode=questionnaire');

    await expect(page.getByRole('article', { name: 'Structured questionnaire' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();

    await page.getByRole('button', { name: 'Stop response' }).click();

    await expect.poll(async () => page.evaluate(() => window.__webmcpE2EChatStatus?.())).toBe('ready');
    await expect
      .poll(async () => page.evaluate(() => window.__webmcpE2EQuestionnaireStatus?.('e2e-cancel-questionnaire')))
      .toBe('skipped');
    await expect.poll(async () => page.evaluate(() => window.__webmcpE2EErrorToolResults?.())).toBe(0);
    await expect(page.getByRole('article', { name: 'Structured questionnaire' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  test('cancel button on the questionnaire card aborts and marks it skipped', async ({ page }) => {
    await page.goto('/chat-cancel-e2e.html?mode=questionnaire');

    await expect(page.getByRole('article', { name: 'Structured questionnaire' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect.poll(async () => page.evaluate(() => window.__webmcpE2EChatStatus?.())).toBe('ready');
    await expect
      .poll(async () => page.evaluate(() => window.__webmcpE2EQuestionnaireStatus?.('e2e-cancel-questionnaire')))
      .toBe('skipped');
    await expect.poll(async () => page.evaluate(() => window.__webmcpE2EErrorToolResults?.())).toBe(0);
    await expect(page.getByRole('article', { name: 'Structured questionnaire' })).toHaveCount(0);
  });
});
