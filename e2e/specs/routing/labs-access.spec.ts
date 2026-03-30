import { routes } from '../../fixtures/routes';
import { expect, test } from '../../test';

test('未命中访问规则时，应拦截 labs 示例页', async ({ page }) => {
  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('仅带站内参数时，不应放宽 labs 示例页访问规则', async ({ page }) => {
  await page.goto(`${routes.labsDemo}?role=admin`);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('已登录但不具备 admin 权限时，应继续拦截 labs 示例页', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aigc-friendly-frontend.auth.session.v1',
      JSON.stringify({
        accessGroup: ['CUSTOMER'],
        accessToken: 'customer-access-token',
        accountId: 1001,
        avatarUrl: null,
        displayName: 'customer-user',
        refreshToken: 'customer-refresh-token',
        role: 'CUSTOMER',
        version: 1,
      }),
    );
  });

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('具备 admin 权限的已登录会话，应允许进入 labs 示例页', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aigc-friendly-frontend.auth.session.v1',
      JSON.stringify({
        accessGroup: ['ADMIN'],
        accessToken: 'admin-access-token',
        accountId: 9527,
        avatarUrl: null,
        displayName: 'admin-user',
        refreshToken: 'admin-refresh-token',
        role: 'ADMIN',
        version: 1,
      }),
    );
  });

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});
