import { expect, test } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';

test('profile 修改登录邮箱需要提交当前登录密码', async ({ page }) => {
  let requestInput: { currentLoginPassword?: string; newLoginEmail?: string } | null = null;

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'profile-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'profile-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            input?: { currentLoginPassword?: string; newLoginEmail?: string };
          };
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query MyProfileBasic')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            myProfileBasic: {
              account: {
                id: 501,
                loginEmail: 'profile-user@example.com',
                loginName: 'profile-user',
                recentLoginHistory: [],
              },
              userInfo: {
                accountId: 501,
                accessGroup: ['STAFF'],
                address: null,
                avatarUrl: null,
                birthDate: null,
                email: 'profile-user@example.com',
                gender: 'SECRET',
                geographic: null,
                nickname: 'Profile User',
                phone: null,
                signature: null,
                tags: [],
                userState: 'ACTIVE',
              },
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation RequestChangeLoginEmail')) {
      requestInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            requestChangeLoginEmail: {
              message: '验证邮件已发送',
              success: true,
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

  await page.goto(routes.profile);
  await page.getByRole('tab', { name: '安全设置' }).click();
  await page.getByLabel('新的登录邮箱').fill('new-profile-email@example.com');
  await page.getByRole('button', { name: '发送验证邮件' }).click();

  await expect(page.getByText('请输入当前登录密码。')).toBeVisible();
  expect(requestInput).toBeNull();

  await page.getByLabel('当前登录密码').fill('current-password');
  await page.getByRole('button', { name: '发送验证邮件' }).click();

  await expect(page.getByText('验证邮件已发送')).toBeVisible();
  expect(requestInput).toEqual({
    currentLoginPassword: 'current-password',
    newLoginEmail: 'new-profile-email@example.com',
  });
});
