import { expect, test } from '../../test';

test('开发模式下应暴露 sandbox 演练场', async ({ page }) => {
  await page.goto('/sandbox/playground');

  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
});
