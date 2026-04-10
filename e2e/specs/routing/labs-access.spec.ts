import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';

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

test('未登录访问 labs invite issuer 时，应先跳登录并保留原目标', async ({ page }) => {
  await page.goto(routes.labsInviteIssuer);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsInviteIssuer)}$`),
  );
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

test('具备 admin 权限的已登录会话，应允许进入 labs invite issuer', async ({ page }) => {
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

  await page.goto(routes.labsInviteIssuer);

  await expect(page.getByRole('heading', { name: '临时邀请签发页' })).toBeVisible();
  await expect(page.getByRole('button', { name: '签发邀请' })).toBeVisible();
});

test('labs invite issuer 可签发 staff invite 并展示生成链接', async ({ page }) => {
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

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation InviteStaff')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            inviteStaff: {
              expiresAt: '2026-04-30T03:00:00.000Z',
              message: '邀请签发成功',
              recordId: 9527,
              success: true,
              token: 'staff-token-001',
              type: 'INVITE_STAFF',
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsInviteIssuer);

  await page.getByLabel('被邀请邮箱').fill('invitee@example.com');
  await page.getByLabel('教职工 ID').fill('staff-001');
  await page.getByRole('button', { name: '签发邀请' }).click();

  await expect(page.getByText('教职工邀请已签发')).toBeVisible();
  await expect(page.locator('text=staff-token-001').first()).toBeVisible();
  await expect(page.getByText('/invite/staff/staff-token-001')).toBeVisible();
});

test('具备 admin 权限但 access token 临近过期时，进入 labs 示例页不应触发前置续期', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'stale-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });

  let refreshRequestCount = 0;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;

    if (typeof payload?.query === 'string' && payload.query.includes('mutation Refresh')) {
      refreshRequestCount += 1;
    }

    await route.fallback();
  });

  await seedAuthSession(page, {
    displayName: 'stale-admin',
    primaryAccessGroup: 'ADMIN',
  });
  await replaceStoredAccessToken(page, createJwtWithExpOffsetMs(30_000));

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
  await expect(page.getByRole('banner').getByText('stale-admin')).toBeVisible();
  expect(refreshRequestCount).toBe(0);
});

test('待补全会话访问 labs 示例页时，应优先分流到 /welcome 而不是返回 403', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accessGroup: ['REGISTRANT'],
      displayName: 'pending-user',
      identity: null,
      identityHint: 'STUDENT',
      needsProfileCompletion: true,
      primaryAccessGroup: 'REGISTRANT',
    },
  });
  await seedAuthSession(page, {
    accessGroup: ['REGISTRANT'],
    displayName: 'pending-user',
    identity: null,
    identityHint: 'STUDENT',
    needsProfileCompletion: true,
    primaryAccessGroup: 'REGISTRANT',
  });

  await page.goto(`${routes.labsDemo}?mode=debug`);

  await expect(page).toHaveURL(
    new RegExp(`/welcome\\?redirect=${encodeURIComponent(`${routes.labsDemo}?mode=debug`)}$`),
  );
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});

test('仅工号 1/2 的管理员会在正式导航中看到载荷加解密入口并可进入', async ({ page }) => {
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

  await page.getByRole('button', { name: '展开导航菜单' }).click();
  await page.getByText('Labs').click();
  await expect(page.getByText('载荷加解密')).toBeVisible();
  await page.getByText('载荷加解密').click();

  await expect(page).toHaveURL(new RegExp(`${routes.labsPayloadCrypto}$`));
  await expect(page.getByRole('heading', { name: '载荷加解密工具' })).toBeVisible();
});

test('其他管理员不应在正式导航中看到载荷加解密入口，且直接访问仍会被拦截', async ({ page }) => {
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

  await page.getByRole('button', { name: '展开导航菜单' }).click();
  await page.getByText('Labs').click();
  await expect(page.getByText('载荷加解密')).toHaveCount(0);

  await page.goto(routes.labsPayloadCrypto);

  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});

test('待补全会话直接访问载荷加解密页时，应优先进入 /welcome 而不是 404', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accessGroup: ['REGISTRANT'],
      accountId: 1,
      displayName: 'pending-admin-like-user',
      identity: null,
      identityHint: 'STAFF',
      needsProfileCompletion: true,
      primaryAccessGroup: 'REGISTRANT',
    },
  });
  await seedAuthSession(page, {
    accessGroup: ['REGISTRANT'],
    accountId: 1,
    displayName: 'pending-admin-like-user',
    identity: null,
    identityHint: 'STAFF',
    needsProfileCompletion: true,
    primaryAccessGroup: 'REGISTRANT',
  });

  await page.goto(`${routes.labsPayloadCrypto}?source=direct`);

  await expect(page).toHaveURL(
    new RegExp(
      `/welcome\\?redirect=${encodeURIComponent(`${routes.labsPayloadCrypto}?source=direct`)}$`,
    ),
  );
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});
