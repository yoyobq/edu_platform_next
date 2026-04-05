import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

test('未登录访问 labs 示例页时，应先跳登录并保留原目标', async ({ page }) => {
  await page.goto(routes.labsDemo);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsDemo)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('未登录访问带查询参数的 labs 示例页时，应保留完整站内目标', async ({ page }) => {
  const target = `${routes.labsDemo}?mode=debug`;

  await page.goto(target);

  await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(target)}$`));
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('已登录但不具备 admin 权限时，应继续拦截 labs 示例页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('具备 admin 权限的已登录会话，应允许进入 labs 示例页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});

test('仅工号 1/2 的管理员会在顶栏看到载荷加解密入口并可进入', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 1,
      displayName: 'root-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    accountId: 1,
    displayName: 'root-admin',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.home);

  await expect(page.getByRole('link', { name: '载荷加解密' })).toBeVisible();
  await page.getByRole('link', { name: '载荷加解密' }).click();

  await expect(page).toHaveURL(new RegExp(`${routes.labsPayloadCrypto}$`));
  await expect(page.getByRole('heading', { name: '载荷加解密工具' })).toBeVisible();
});

test('其他管理员不应在顶栏看到载荷加解密入口，且直接访问仍会被拦截', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 9527,
      displayName: 'normal-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    accountId: 9527,
    displayName: 'normal-admin',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.home);

  await expect(page.getByRole('link', { name: '载荷加解密' })).toHaveCount(0);

  await page.goto(routes.labsPayloadCrypto);

  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});
