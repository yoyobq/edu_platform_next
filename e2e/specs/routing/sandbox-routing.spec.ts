import { expect, test } from '@playwright/test';

test('exposes sandbox playground in development mode', async ({ page }) => {
  await page.goto('/sandbox/playground');

  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
});
