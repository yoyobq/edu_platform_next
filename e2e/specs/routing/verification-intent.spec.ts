import { routes } from '../../fixtures/routes';
import { mockApiHealth, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';

const verificationCases = [
  {
    title: '邀请入口应通过 path-first 路由落到 public entry 分支',
    path: routes.invite('workspace', 'invite-code-001'),
    heading: '邀请入口',
    assertions: ['邀请类型', 'workspace', '验证代码', 'invite-code-001'],
  },
  {
    title: '重置密码入口应通过 path-first 路由落到 public entry 分支',
    path: routes.resetPassword('reset-password-001'),
    heading: '设置新密码',
    assertions: [],
  },
  {
    title: 'Magic Link 入口应通过 path-first 路由落到 public entry 分支',
    path: routes.magicLink('magic-link-001'),
    heading: 'Magic Link 入口',
    assertions: ['验证代码', 'magic-link-001'],
  },
] as const;

for (const verificationCase of verificationCases) {
  test(verificationCase.title, async ({ page }) => {
    await page.goto(verificationCase.path);

    await expect(page).toHaveURL(new RegExp(`${verificationCase.path}$`));
    await expect(page.getByRole('heading', { name: verificationCase.heading })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);

    for (const assertion of verificationCase.assertions) {
      await expect(page.getByText(assertion)).toBeVisible();
    }
  });
}

function getQuery(pageRoute: {
  request: () => {
    postDataJSON: () => { query?: string } | undefined;
  };
}) {
  const payload = pageRoute.request().postDataJSON();

  return typeof payload?.query === 'string' ? payload.query : '';
}

async function fulfillGraphQL(
  pageRoute: {
    fulfill: (options: { body: string; contentType: string; status: number }) => Promise<void>;
  },
  body: unknown,
) {
  await pageRoute.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

test('邮箱验证成功后应更新 loginEmail 并刷新当前浏览器会话', async ({ page }) => {
  let consumeAuthHeader: string | null = 'UNSET';
  let refreshRequestCount = 0;

  await mockApiHealth(page);
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('mutation ConsumeChangeLoginEmail')) {
      consumeAuthHeader = route.request().headers().authorization ?? null;
      await fulfillGraphQL(route, {
        data: {
          consumeChangeLoginEmail: {
            accountId: 9527,
            loginEmail: 'verified.login@example.com',
            message: '登录邮箱已更新',
            reason: null,
            success: true,
          },
        },
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      refreshRequestCount += 1;
      await fulfillGraphQL(route, {
        data: {
          refresh: {
            accessToken: 'admin-access-token-refreshed',
            refreshToken: 'admin-refresh-token-refreshed',
          },
        },
      });
      return;
    }

    if (query.includes('query Me')) {
      await fulfillGraphQL(route, {
        data: {
          me: {
            account: {
              id: 9527,
              identityHint: 'ADMIN',
              loginEmail: 'verified.login@example.com',
              loginName: 'admin-user',
              status: 'ACTIVE',
            },
            accountId: 9527,
            identity: null,
            needsProfileCompletion: false,
            userInfo: {
              accessGroup: ['ADMIN'],
              avatarUrl: null,
              email: 'admin-user@example.com',
              nickname: 'admin-user',
            },
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.verifyEmail('verify-email-success-001'));

  await expect(page.getByRole('heading', { name: '确认登录邮箱' })).toBeVisible();
  await expect(page.getByText('邮箱验证已完成')).toBeVisible();
  await expect(page.getByText('verified.login@example.com')).toBeVisible();
  await expect(page.getByText('当前浏览器会话已同步')).toBeVisible();
  await expect(page.getByRole('button', { name: '继续进入工作台' })).toBeVisible();

  expect(consumeAuthHeader).toBe('Bearer admin-access-token');
  expect(refreshRequestCount).toBe(1);

  const storedSession = await page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);

    return raw ? (JSON.parse(raw) as { account?: { loginEmail?: string | null } }) : null;
  }, AUTH_STORAGE_KEY);

  expect(storedSession?.account?.loginEmail).toBe('verified.login@example.com');
});

test('邮箱验证链接失效时应展示失败态且不刷新会话', async ({ page }) => {
  let refreshRequestCount = 0;

  await mockApiHealth(page);

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('mutation ConsumeChangeLoginEmail')) {
      await fulfillGraphQL(route, {
        data: {
          consumeChangeLoginEmail: {
            accountId: null,
            loginEmail: null,
            message: '这个邮箱验证链接已经过期，请重新发起登录邮箱变更。',
            reason: 'EXPIRED',
            success: false,
          },
        },
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      refreshRequestCount += 1;
      await fulfillGraphQL(route, {
        data: {
          refresh: null,
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.verifyEmail('verify-email-expired-001'));

  await expect(page.getByRole('heading', { name: '确认登录邮箱' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('验证链接已过期');
  await expect(page.getByRole('alert')).toContainText('这个邮箱验证链接已经过期');
  await expect(page.getByRole('button', { name: '返回登录' })).toBeVisible();
  expect(refreshRequestCount).toBe(0);
});

test('已有本地 session 时，invite/magic-link 壳页不应主动触发 me 或 refresh', async ({ page }) => {
  let meRequestCount = 0;
  let refreshRequestCount = 0;

  await mockApiHealth(page);
  await seedAuthSession(page, {
    displayName: 'stale-admin',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query Me')) {
      meRequestCount += 1;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            me: null,
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      refreshRequestCount += 1;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            refresh: null,
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.invite('workspace', 'invite-code-001'));
  await expect(page.getByRole('heading', { name: '邀请入口' })).toBeVisible();

  await page.goto(routes.magicLink('magic-link-001'));
  await expect(page.getByRole('heading', { name: 'Magic Link 入口' })).toBeVisible();

  expect(meRequestCount).toBe(0);
  expect(refreshRequestCount).toBe(0);
});
