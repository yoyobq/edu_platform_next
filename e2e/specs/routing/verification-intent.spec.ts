import { routes } from '../../fixtures/routes';
import { mockApiHealth, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

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

test('邮箱验证页应先展示确认信息，确认后更新 loginEmail 并要求重新登录', async ({ page }) => {
  let consumeAuthHeader: string | null = 'UNSET';
  let findIntentRequestCount = 0;

  await mockApiHealth(page);
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query FindChangeLoginEmailVerificationRecord')) {
      findIntentRequestCount += 1;
      await fulfillGraphQL(route, {
        data: {
          findVerificationRecord: {
            message: null,
            reason: null,
            success: true,
            record: {
              notBefore: null,
              publicPayload: {
                flowId: 'change-login-email',
                title: '登录邮箱变更确认',
                description: '请确认新的登录邮箱地址，以完成登录邮箱更换。',
                verifyUrl: 'http://localhost:5173/verify/email',
                preview: {
                  kind: 'change-login-email',
                  fromMasked: 'ad***@example.com',
                  toMasked: 've***@example.com',
                },
              },
              status: 'ACTIVE',
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeChangeLoginEmail')) {
      consumeAuthHeader = route.request().headers().authorization ?? null;
      await fulfillGraphQL(route, {
        data: {
          consumeChangeLoginEmail: {
            accountId: 9527,
            loginEmail: 'verified.login@example.com',
            message: '登录邮箱已更新',
            oldLoginEmail: 'admin-user@example.com',
            reason: null,
            success: true,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.verifyEmail('verify-email-success-001'));

  await expect(page.getByRole('heading', { name: '确认登录邮箱' })).toBeVisible();
  await expect(page.getByText('确认更换登录邮箱')).toBeVisible();
  await expect(page.getByText('ad***@example.com')).toBeVisible();
  await expect(page.getByText('ve***@example.com')).toBeVisible();
  await page.getByRole('button', { name: '确认更换并重新登录' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '登录邮箱已更新' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '请重新登录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '前往登录' })).toBeVisible();

  expect(consumeAuthHeader).toBe('Bearer admin-access-token');
  expect(findIntentRequestCount).toBe(1);

  const storedSession = await page.evaluate((storageKey) => {
    return window.localStorage.getItem(storageKey);
  }, 'aigc-friendly-frontend.auth.session.v2');

  expect(storedSession).toBeNull();
});

test('邮箱验证链接失效时应展示失败态并停止在确认前', async ({ page }) => {
  await mockApiHealth(page);

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query FindChangeLoginEmailVerificationRecord')) {
      await fulfillGraphQL(route, {
        data: {
          findVerificationRecord: {
            message: '这个邮箱验证链接已经过期，请重新发起登录邮箱变更。',
            reason: 'EXPIRED',
            success: false,
            record: null,
          },
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
