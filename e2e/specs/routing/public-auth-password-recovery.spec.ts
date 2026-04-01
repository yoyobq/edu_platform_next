import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { expect, test } from '../../test';

type ResetIntentStatus = 'active' | 'expired' | 'used' | 'invalid';

async function mockForgotPasswordMutations(page: Page) {
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;

    if (typeof payload?.query !== 'string') {
      await route.fallback();
      return;
    }

    if (payload.query.includes('mutation RequestPasswordResetEmail')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            requestPasswordResetEmail: {
              message: null,
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
}

async function mockResetPasswordFlow(
  page: Page,
  status: ResetIntentStatus,
  options?: { resetPasswordErrorMessage?: string },
) {
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;

    if (typeof payload?.query !== 'string') {
      await route.fallback();
      return;
    }

    if (payload.query.includes('query FindPasswordResetVerificationRecord')) {
      const record =
        status === 'invalid'
          ? null
          : {
              notBefore: null,
              status:
                status === 'active' ? 'ACTIVE' : status === 'expired' ? 'EXPIRED' : 'CONSUMED',
            };

      await route.fulfill({
        body: JSON.stringify({
          data: {
            findVerificationRecord: record,
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (payload.query.includes('mutation ResetPassword')) {
      if (options?.resetPasswordErrorMessage) {
        await route.fulfill({
          body: JSON.stringify({
            errors: [
              {
                message: options.resetPasswordErrorMessage,
              },
            ],
          }),
          contentType: 'application/json',
          status: 200,
        });
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            resetPassword: {
              message: null,
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
}

test('登录页应提供忘记密码入口，并能完成统一反馈', async ({ page }) => {
  await mockForgotPasswordMutations(page);

  await page.goto(routes.login);
  await page.getByRole('button', { name: '忘记密码' }).click();

  await expect(page).toHaveURL(routes.forgotPassword);
  await expect(page.getByRole('heading', { name: '找回你的账户密码' })).toBeVisible();

  await page.getByLabel('邮箱').fill('tester@example.com');
  await page.getByRole('button', { name: '发送重置邮件' }).click();

  await expect(page.getByText('若该账户存在，我们已发送重置邮件。')).toBeVisible();
  await expect(page.getByRole('button', { name: '返回登录' })).toBeVisible();
});

test('reset code 有效时，应允许更新密码并返回登录', async ({ page }) => {
  await mockResetPasswordFlow(page, 'active');

  await page.goto(routes.resetPassword('reset-token-active'));

  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  await page.getByLabel('新密码', { exact: true }).fill('password-1234');
  await page.getByLabel('确认新密码').fill('password-1234');
  await page.getByRole('button', { name: '更新密码' }).click();

  await expect(page.getByText('密码已更新')).toBeVisible();
  await expect(page.getByRole('button', { name: '返回登录' })).toBeVisible();
});

test('query token 形式的 reset link 也应进入重置页面', async ({ page }) => {
  await mockResetPasswordFlow(page, 'active');

  await page.goto(routes.resetPasswordWithTokenQuery('reset-token-query-active'));

  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();
  await expect(page.getByText('reset-token-query-active')).toBeVisible();
});

test('reset code 提交时若已过期，应切换到失败态', async ({ page }) => {
  await mockResetPasswordFlow(page, 'active', {
    resetPasswordErrorMessage: 'verification token expired',
  });

  await page.goto(routes.resetPassword('reset-token-expired-on-submit'));

  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  await page.getByLabel('新密码', { exact: true }).fill('password-1234');
  await page.getByLabel('确认新密码').fill('password-1234');
  await page.getByRole('button', { name: '更新密码' }).click();

  await expect(page.getByText('重置链接不可用')).toBeVisible();
  await expect(page.getByText('这个重置链接已经过期，请重新发起找回密码流程。')).toBeVisible();
});

test('reset code 无效时，应显示失败态', async ({ page }) => {
  await mockResetPasswordFlow(page, 'invalid');

  await page.goto(routes.resetPassword('reset-token-invalid'));

  await expect(page.getByText('重置链接不可用')).toBeVisible();
  await expect(page.getByText('这个重置链接无效，请检查邮件中的链接是否完整。')).toBeVisible();
});

test('reset code 过期时，应显示失败态', async ({ page }) => {
  await mockResetPasswordFlow(page, 'expired');

  await page.goto(routes.resetPassword('reset-token-expired'));

  await expect(page.getByText('重置链接不可用')).toBeVisible();
  await expect(page.getByText('这个重置链接已经过期，请重新发起找回密码流程。')).toBeVisible();
});

test('reset code 已使用时，应显示失败态', async ({ page }) => {
  await mockResetPasswordFlow(page, 'used');

  await page.goto(routes.resetPassword('reset-token-used'));

  await expect(page.getByText('重置链接不可用')).toBeVisible();
  await expect(page.getByText('这个重置链接已经被使用，请重新发起找回密码流程。')).toBeVisible();
});
