import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

test('test 环境下未登录访问 sandbox 时，应先跳登录并保留原目标', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_APP_ENV === 'prod');

  await page.goto('/sandbox/playground');

  await expect(page).toHaveURL(/\/login\?redirect=%2Fsandbox%2Fplayground$/);
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('test 环境下具备会话时，应允许进入 sandbox 演练场', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_APP_ENV === 'prod');

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: { displayName: 'admin-user', primaryAccessGroup: 'ADMIN' },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto('/sandbox/playground');

  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
});

test('prod 环境下访问 sandbox 时，应先按环境规则返回 404', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_APP_ENV !== 'prod');

  await page.goto('/sandbox/playground');

  await expect(page).toHaveURL(/\/sandbox\/playground$/);
  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '账户登录' })).toHaveCount(0);
});
