import { expect, test } from '@playwright/test';

import { openHome } from '../../helpers/app';

test('keeps main area interactive while the entry sidecar is open', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();

  await page.getByRole('link', { name: '沙盒演练场' }).click();

  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});
