import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import {
  mockApiHealth,
  mockAuthGraphQL,
  seedAuthSession,
  type SeedAuthSessionOptions,
} from '../../helpers/app';
import { expect, test } from '../../test';

function layoutBanner(page: Page) {
  return page.getByRole('banner');
}

async function submitLogin(page: Page) {
  await page.getByLabel('登录名或邮箱').fill('tester@example.com');
  await page.getByLabel('密码').fill('password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
}

function createAdminSession(overrides: SeedAuthSessionOptions = {}): SeedAuthSessionOptions {
  return {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
    ...overrides,
  };
}

test('未登录访问首页时，应跳到携带 redirect 的登录页', async ({ page }) => {
  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
  await expect(layoutBanner(page)).toHaveCount(0);
});

test('登录成功后，应按 redirect 进入目标页并呈现已认证状态', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
  });

  await page.goto(`${routes.login}?redirect=${encodeURIComponent(routes.labsDemo)}`);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/labs\/demo$/);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
  await expect(layoutBanner(page).getByText('身份：admin')).toBeVisible();
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
});

test('登录成功但 me 失败时，应停留在登录页并显示错误', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
    meErrorSequence: ['TOKEN_INVALID'],
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText('TOKEN_INVALID');
});

test('登录成功后刷新页面，应通过 me 从本地会话恢复认证状态', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession(),
    loginSession: createAdminSession(),
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();

  await page.reload();

  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
  await expect(layoutBanner(page).getByText('身份：admin')).toBeVisible();

  await page.goto(routes.labsDemo);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});

test('本地 access token 失效时，应走 refresh 后恢复会话', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'stale-admin' }),
    meErrorSequence: ['TOKEN_INVALID'],
    refreshSession: createAdminSession({ displayName: 'refreshed-admin' }),
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'stale-admin' }));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expect(layoutBanner(page).getByText('refreshed-admin')).toBeVisible();
  await expect(layoutBanner(page).getByText('身份：admin')).toBeVisible();
});

test('本地会话失效且 refresh 失败时，应强制回到登录页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'expired-admin' }),
    meErrorSequence: ['TOKEN_INVALID'],
    refreshErrorMessage: 'TOKEN_INVALID',
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'expired-admin' }));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('当前会话已失效，请重新登录。');
  await expect(
    page.evaluate(() => window.localStorage.getItem('aigc-friendly-frontend.auth.session.v2')),
  ).resolves.toBeNull();
});

test('退出登录后，应清空会话并重新拦截 labs 访问', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession(),
    loginSession: createAdminSession(),
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();

  await page.getByRole('button', { name: /退\s*出/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
  await expect(
    page.evaluate(() => window.localStorage.getItem('aigc-friendly-frontend.auth.session.v2')),
  ).resolves.toBeNull();

  await page.goto(routes.labsDemo);
  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsDemo)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('redirect 指向站外地址时，登录后应回退到首页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
  });

  await page.goto(`${routes.login}?redirect=${encodeURIComponent('//evil.example/phishing')}`);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
});

test('redirect 重新指向登录页时，登录后应回退到首页而不是形成回环', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
  });

  await page.goto(
    `${routes.login}?redirect=${encodeURIComponent('/login?redirect=%2Flabs%2Fdemo')}`,
  );
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
});
