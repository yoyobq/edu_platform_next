import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { expect, test } from '../../test';

type MockLoginOptions = {
  accessGroup?: readonly ('ADMIN' | 'CUSTOMER')[];
  accountId?: number;
  displayName?: string;
  role?: 'ADMIN' | 'CUSTOMER';
};

async function mockPlatformStatus(page: Page) {
  await page.route(/\/health(?:\/readiness)?$/, async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        ok: true,
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

async function mockLoginMutation(page: Page, options: MockLoginOptions = {}) {
  const role = options.role ?? 'ADMIN';
  const accessGroup = options.accessGroup ?? [role];
  const displayName = options.displayName ?? `${role.toLowerCase()}-user`;
  const accountId = options.accountId ?? (role === 'ADMIN' ? 9527 : 1001);

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;

    if (typeof payload?.query === 'string' && payload.query.includes('mutation Login')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            login: {
              accessToken: `${role.toLowerCase()}-access-token`,
              accountId,
              refreshToken: `${role.toLowerCase()}-refresh-token`,
              role,
              userInfo: {
                accessGroup,
                avatarUrl: null,
                nickname: displayName,
              },
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
}

async function submitLogin(page: Page) {
  await page.getByLabel('登录名或邮箱').fill('tester@example.com');
  await page.getByLabel('密码').fill('password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
}

function layoutBanner(page: Page) {
  return page.getByRole('banner');
}

test('登录成功后，应按 redirect 进入目标页并呈现已认证状态', async ({ page }) => {
  await mockPlatformStatus(page);
  await mockLoginMutation(page, {
    displayName: 'admin-user',
    role: 'ADMIN',
  });

  await page.goto(`${routes.login}?redirect=${encodeURIComponent(routes.labsDemo)}`);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/labs\/demo$/);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
  await expect(layoutBanner(page).getByText('角色：admin')).toBeVisible();
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
});

test('登录成功后刷新页面，应从本地会话恢复认证状态', async ({ page }) => {
  await mockPlatformStatus(page);
  await mockLoginMutation(page, {
    displayName: 'admin-user',
    role: 'ADMIN',
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();

  await page.unroute('**/graphql');
  await page.reload();

  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
  await expect(layoutBanner(page).getByText('角色：admin')).toBeVisible();

  await page.goto(routes.labsDemo);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});

test('退出登录后，应清空会话并重新拦截 labs 访问', async ({ page }) => {
  await mockPlatformStatus(page);
  await mockLoginMutation(page, {
    displayName: 'admin-user',
    role: 'ADMIN',
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();

  await page.getByRole('button', { name: /退\s*出/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();

  await page.goto(routes.labsDemo);
  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('redirect 指向站外地址时，登录后应回退到首页', async ({ page }) => {
  await mockPlatformStatus(page);
  await mockLoginMutation(page, {
    displayName: 'admin-user',
    role: 'ADMIN',
  });

  await page.goto(`${routes.login}?redirect=${encodeURIComponent('//evil.example/phishing')}`);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
  await expect(layoutBanner(page).getByText('admin-user')).toBeVisible();
});
