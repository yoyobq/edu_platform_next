import { expect, test } from '../../test';

test('blocks labs demo when the access rule is not matched', async ({ page }) => {
  await page.goto('/labs/demo');

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('allows labs demo when the admin role is present', async ({ page }) => {
  await page.goto('/labs/demo?role=admin');

  await expect(page.getByRole('heading', { name: 'Labs 示例页' })).toBeVisible();
});
