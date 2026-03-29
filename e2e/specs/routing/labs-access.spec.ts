import { expect, test } from '../../test';

test('未命中访问规则时，应拦截 labs 示例页', async ({ page }) => {
  await page.goto('/labs/demo');

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('带有 admin 角色时，应允许进入 labs 示例页', async ({ page }) => {
  await page.goto('/labs/demo?role=admin');

  await expect(page.getByRole('heading', { name: 'Labs 示例页' })).toBeVisible();
});
