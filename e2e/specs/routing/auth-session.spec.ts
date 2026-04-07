import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import {
  mockApiHealth,
  mockAuthGraphQL,
  seedAuthSession,
  type SeedAuthSessionOptions,
} from '../../helpers/app';
import { expect, test } from '../../test';

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';

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

function createJwtWithExpOffsetMs(offsetMs: number) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor((Date.now() + offsetMs) / 1000),
    }),
  ).toString('base64url');

  return `${header}.${payload}.signature`;
}

async function replaceStoredAccessToken(page: Page, accessToken: string) {
  await page.addInitScript(
    ({ accessToken: nextAccessToken, storageKey }) => {
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        throw new Error('missing auth session');
      }

      const parsed = JSON.parse(raw) as {
        accessToken: string;
      };

      parsed.accessToken = nextAccessToken;
      window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    },
    {
      accessToken,
      storageKey: AUTH_STORAGE_KEY,
    },
  );
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

test('登录成功后不应等待 me 完成才离开登录页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
    meDelayMs: 1500,
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '正在同步账户信息' })).toBeVisible();
  await expect(layoutBanner(page).getByRole('button', { name: '取消登录' })).toBeVisible();
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
  await expect(layoutBanner(page).getByText('身份：admin')).toBeVisible();
});

test('登录成功但 me 失败时，应停留在登录页并显示错误', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
    meErrorSequence: ['TOKEN_INVALID'],
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
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

test('refresh 成功后 me 再失败时，应强制回到登录页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'stale-admin' }),
    meErrorSequence: ['TOKEN_INVALID', 'TOKEN_INVALID_AFTER_REFRESH'],
    refreshSession: createAdminSession({ displayName: 'refreshed-admin' }),
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'stale-admin' }));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
  await expect(
    page.evaluate(() => window.localStorage.getItem('aigc-friendly-frontend.auth.session.v2')),
  ).resolves.toBeNull();
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
  await expect(
    page.evaluate(() => window.localStorage.getItem('aigc-friendly-frontend.auth.session.v2')),
  ).resolves.toBeNull();
});

test('access token 临近过期但 me 仍可用时，首页导航不应因前置续期被阻断', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'stale-admin' }),
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'stale-admin' }));
  await replaceStoredAccessToken(page, createJwtWithExpOffsetMs(-120_000));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expect(layoutBanner(page).getByText('stale-admin')).toBeVisible();
  await expect(
    page.evaluate((storageKey) => window.localStorage.getItem(storageKey), AUTH_STORAGE_KEY),
  ).resolves.not.toBeNull();
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
  await expect(page.getByText('结束会话')).toBeVisible();
  await page.getByRole('button', { name: '江湖再见' }).click();

  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
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
  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
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

test('已认证会话访问 login 且 redirect 先指向 /welcome 时，应直接解到最终站内目标', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession(),
  });
  await seedAuthSession(page, createAdminSession());

  await page.goto(
    `${routes.login}?redirect=${encodeURIComponent('/welcome?redirect=%2Flabs%2Fdemo')}`,
  );

  await expect(page).toHaveURL(/\/labs\/demo$/);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});
