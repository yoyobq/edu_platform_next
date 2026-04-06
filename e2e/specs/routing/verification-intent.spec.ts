import { routes } from '../../fixtures/routes';
import { mockApiHealth, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const verificationCases = [
  {
    title: '邀请入口应通过 path-first 路由落到 public entry 分支',
    path: routes.invite('workspace', 'invite-code-001'),
    heading: '邀请入口',
    assertions: ['邀请类型', 'workspace', '验证代码', 'invite-code-001'],
    shouldShowEntryLabel: true,
  },
  {
    title: '邮箱验证入口应通过 path-first 路由落到 public entry 分支',
    path: routes.verifyEmail('verify-email-001'),
    heading: '邮箱验证入口',
    assertions: ['验证代码', 'verify-email-001'],
    shouldShowEntryLabel: true,
  },
  {
    title: '重置密码入口应通过 path-first 路由落到 public entry 分支',
    path: routes.resetPassword('reset-password-001'),
    heading: '设置新密码',
    assertions: [],
    shouldShowEntryLabel: false,
  },
  {
    title: 'Magic Link 入口应通过 path-first 路由落到 public entry 分支',
    path: routes.magicLink('magic-link-001'),
    heading: 'Magic Link 入口',
    assertions: ['验证代码', 'magic-link-001'],
    shouldShowEntryLabel: true,
  },
] as const;

for (const verificationCase of verificationCases) {
  test(verificationCase.title, async ({ page }) => {
    await page.goto(verificationCase.path);

    await expect(page).toHaveURL(new RegExp(`${verificationCase.path}$`));
    await expect(page.getByRole('heading', { name: verificationCase.heading })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);

    if (verificationCase.shouldShowEntryLabel) {
      await expect(page.getByText('公共认证入口')).toBeVisible();
    } else {
      await expect(page.getByText('公共认证入口')).toHaveCount(0);
      await expect(page.getByText('验证代码')).toHaveCount(0);
      await expect(page.getByText('reset-password-001')).toHaveCount(0);
    }

    for (const assertion of verificationCase.assertions) {
      await expect(page.getByText(assertion)).toBeVisible();
    }
  });
}

test('已有本地 session 时，invite/verify-email/magic-link 壳页不应主动触发 me 或 refresh', async ({
  page,
}) => {
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

  await page.goto(routes.verifyEmail('verify-email-001'));
  await expect(page.getByRole('heading', { name: '邮箱验证入口' })).toBeVisible();

  await page.goto(routes.magicLink('magic-link-001'));
  await expect(page.getByRole('heading', { name: 'Magic Link 入口' })).toBeVisible();

  expect(meRequestCount).toBe(0);
  expect(refreshRequestCount).toBe(0);
});
