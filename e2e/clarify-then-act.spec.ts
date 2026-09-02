import { expect, test } from '@playwright/test';

test.describe('clarify-then-act spawn_prop questionnaire', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clarify-then-act-e2e.html');
    await expect(page.getByRole('article', { name: 'Structured questionnaire' })).toBeVisible();
  });

  test('shows spawn_prop clarify dock before structured answers', async ({ page }) => {
    await expect(page.getByText('Before spawn_prop')).toBeVisible();
    await expect(page.getByText('Choose a mesh')).toBeVisible();
    await expect(page.getByRole('button', { name: /Box/i })).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('World position')).toBeVisible();

    await page.getByLabel('Position').fill('[0, 1, 0]');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Hex tint')).toBeVisible();
    await page.getByLabel('Color').fill('#ff0000');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect
      .poll(async () => page.evaluate(() => window.__webmcpE2EAnswers))
      .toEqual({
        mesh: 'primitive:box',
        position: '[0, 1, 0]',
        color: '#ff0000',
      });
  });

  test('dock blocks interaction until submit (spawn clarify path)', async ({ page }) => {
    await expect(page.getByRole('article', { name: 'Structured questionnaire' })).toBeVisible();
    await expect(page.getByText('Before spawn_prop')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });
});
