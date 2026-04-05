import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { expect, test } from '../../test';

type ResetIntentStatus = 'active' | 'expired' | 'used' | 'invalid';
type TransportFailureKind = 'graphql' | 'http' | 'network';
type VerificationRecordFailureReason = 'EXPIRED' | 'INVALID' | 'USED';

function getGraphQLPayload(
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never,
) {
  return route.request().postDataJSON() as
    | {
        query?: string;
        variables?: {
          input?: {
            token?: string;
          };
        };
      }
    | undefined;
}

async function fulfillTransportFailure(
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never,
  kind: TransportFailureKind,
  message: string,
) {
  if (kind === 'network') {
    await route.abort('failed');
    return;
  }

  if (kind === 'http') {
    await route.fulfill({
      body: JSON.stringify({
        errors: [{ message }],
      }),
      contentType: 'application/json',
      status: 500,
    });
    return;
  }

  await route.fulfill({
    body: JSON.stringify({
      errors: [{ message }],
    }),
    contentType: 'application/json',
    status: 200,
  });
}

async function mockForgotPasswordMutations(page: Page) {
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);

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

async function mockForgotPasswordTransportError(
  page: Page,
  kind: TransportFailureKind,
  message: string,
) {
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);

    if (typeof payload?.query !== 'string') {
      await route.fallback();
      return;
    }

    if (payload.query.includes('mutation RequestPasswordResetEmail')) {
      await fulfillTransportFailure(route, kind, message);
      return;
    }

    await route.fallback();
  });
}

async function mockResetPasswordFlow(
  page: Page,
  status: ResetIntentStatus,
  options?: { resetPasswordFailureReason?: VerificationRecordFailureReason },
) {
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);

    if (typeof payload?.query !== 'string') {
      await route.fallback();
      return;
    }

    if (payload.query.includes('query FindPasswordResetVerificationRecord')) {
      const result =
        status === 'active'
          ? {
              message: null,
              reason: null,
              record: {
                notBefore: null,
                status: 'ACTIVE',
              },
              success: true,
            }
          : {
              message: null,
              reason: status === 'expired' ? 'EXPIRED' : status === 'used' ? 'USED' : 'INVALID',
              record: null,
              success: false,
            };

      await route.fulfill({
        body: JSON.stringify({
          data: {
            findVerificationRecord: result,
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (payload.query.includes('mutation ResetPassword')) {
      if (options?.resetPasswordFailureReason) {
        await route.fulfill({
          body: JSON.stringify({
            data: {
              resetPassword: {
                message: null,
                reason: options.resetPasswordFailureReason,
                success: false,
              },
            },
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

async function mockResetPasswordIntentTransportError(
  page: Page,
  kind: TransportFailureKind,
  message: string,
) {
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);

    if (typeof payload?.query !== 'string') {
      await route.fallback();
      return;
    }

    if (payload.query.includes('query FindPasswordResetVerificationRecord')) {
      await fulfillTransportFailure(route, kind, message);
      return;
    }

    await route.fallback();
  });
}

async function mockResetPasswordSubmitTransportError(
  page: Page,
  kind: TransportFailureKind,
  message: string,
) {
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);

    if (typeof payload?.query !== 'string') {
      await route.fallback();
      return;
    }

    if (payload.query.includes('query FindPasswordResetVerificationRecord')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            findVerificationRecord: {
              message: null,
              reason: null,
              record: {
                notBefore: null,
                status: 'ACTIVE',
              },
              success: true,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (payload.query.includes('mutation ResetPassword')) {
      await fulfillTransportFailure(route, kind, message);
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

test('忘记密码请求遇到 GraphQL transport error 时，应停留当前页并展示错误反馈', async ({
  page,
}) => {
  await mockForgotPasswordTransportError(page, 'graphql', 'PASSWORD_RESET_GATEWAY_DOWN');

  await page.goto(routes.forgotPassword);
  await page.getByLabel('邮箱').fill('tester@example.com');
  await page.getByRole('button', { name: '发送重置邮件' }).click();

  await expect(page).toHaveURL(routes.forgotPassword);
  await expect(page.getByRole('alert')).toContainText('请求处理失败，请稍后重试。');
});

test('忘记密码请求遇到 network transport error 时，应展示统一中文提示', async ({ page }) => {
  await mockForgotPasswordTransportError(page, 'network', 'PASSWORD_RESET_NETWORK_DOWN');

  await page.goto(routes.forgotPassword);
  await page.getByLabel('邮箱').fill('tester@example.com');
  await page.getByRole('button', { name: '发送重置邮件' }).click();

  await expect(page).toHaveURL(routes.forgotPassword);
  await expect(page.getByRole('alert')).toContainText('网络连接异常，请稍后重试。');
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
  const observedVerificationTokens: string[] = [];
  const observedResetTokens: string[] = [];

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            input?: {
              token?: string;
            };
          };
        }
      | undefined;

    if (typeof payload?.query !== 'string') {
      await route.fallback();
      return;
    }

    if (payload.query.includes('query FindPasswordResetVerificationRecord')) {
      observedVerificationTokens.push(payload.variables?.input?.token ?? '');

      await route.fulfill({
        body: JSON.stringify({
          data: {
            findVerificationRecord: {
              message: null,
              reason: null,
              record: {
                notBefore: null,
                status: 'ACTIVE',
              },
              success: true,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (payload.query.includes('mutation ResetPassword')) {
      observedResetTokens.push(payload.variables?.input?.token ?? '');

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

  await page.goto(routes.resetPasswordWithTokenQuery('reset-token-query-active'));

  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();
  await expect(page.getByText('公共认证入口')).toHaveCount(0);
  await expect(page.getByText('验证代码')).toHaveCount(0);
  await expect(page.getByText('reset-token-query-active')).toHaveCount(0);

  await page.getByLabel('新密码', { exact: true }).fill('password-1234');
  await page.getByLabel('确认新密码').fill('password-1234');
  await page.getByRole('button', { name: '更新密码' }).click();

  await expect(page.getByText('密码已更新')).toBeVisible();
  expect(observedVerificationTokens).toEqual(['reset-token-query-active']);
  expect(observedResetTokens).toEqual(['reset-token-query-active']);
});

test('reset intent 查询遇到 GraphQL transport error 时，应进入 error 状态并展示统一提示', async ({
  page,
}) => {
  await mockResetPasswordIntentTransportError(page, 'graphql', 'RESET_INTENT_LOOKUP_FAILED');

  await page.goto(routes.resetPassword('reset-token-transport-failed'));

  await expect(page.getByText('操作失败')).toBeVisible();
  await expect(page.getByText('请求处理失败，请稍后重试。')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新发送重置邮件' })).toBeVisible();
});

test('reset intent 查询遇到 network transport error 时，应进入 error 状态并展示网络提示', async ({
  page,
}) => {
  await mockResetPasswordIntentTransportError(page, 'network', 'RESET_INTENT_LOOKUP_NETWORK_DOWN');

  await page.goto(routes.resetPassword('reset-token-network-failed'));

  await expect(page.getByText('操作失败')).toBeVisible();
  await expect(page.getByText('网络连接异常，请稍后重试。')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新发送重置邮件' })).toBeVisible();
});

test('reset password 页面应在首次输入时给出字段级密码校验', async ({ page }) => {
  await mockResetPasswordFlow(page, 'active');

  await page.goto(routes.resetPassword('reset-token-password-rules'));

  await page.getByLabel('新密码', { exact: true }).fill('abcdefgh');

  await expect(
    page.getByText('密码至少 8 位，且需包含字母、数字、符号中的至少两种。'),
  ).toBeVisible();
});

test('reset code 提交时若已过期，应切换到失败态', async ({ page }) => {
  await mockResetPasswordFlow(page, 'active', {
    resetPasswordFailureReason: 'EXPIRED',
  });

  await page.goto(routes.resetPassword('reset-token-expired-on-submit'));

  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  await page.getByLabel('新密码', { exact: true }).fill('password-1234');
  await page.getByLabel('确认新密码').fill('password-1234');
  await page.getByRole('button', { name: '更新密码' }).click();

  await expect(page.getByText('重置链接不可用')).toBeVisible();
  await expect(page.getByText('这个重置链接已经过期，请重新发起找回密码流程。')).toBeVisible();
});

test('reset password 提交遇到 transport error 时，应停留表单态并展示错误反馈', async ({ page }) => {
  await mockResetPasswordSubmitTransportError(page, 'graphql', 'RESET_PASSWORD_TRANSPORT_FAILED');

  await page.goto(routes.resetPassword('reset-token-submit-transport-failed'));

  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  await page.getByLabel('新密码', { exact: true }).fill('password-1234');
  await page.getByLabel('确认新密码').fill('password-1234');
  await page.getByRole('button', { name: '更新密码' }).click();

  await expect(page.getByRole('alert')).toContainText('请求处理失败，请稍后重试。');
  await expect(page.getByRole('button', { name: '更新密码' })).toBeVisible();
});

test('reset password 提交遇到 http transport error 时，应停留表单态并展示服务异常提示', async ({
  page,
}) => {
  await mockResetPasswordSubmitTransportError(page, 'http', 'RESET_PASSWORD_HTTP_FAILED');

  await page.goto(routes.resetPassword('reset-token-submit-http-failed'));

  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  await page.getByLabel('新密码', { exact: true }).fill('password-1234');
  await page.getByLabel('确认新密码').fill('password-1234');
  await page.getByRole('button', { name: '更新密码' }).click();

  await expect(page.getByRole('alert')).toContainText('服务暂时不可用，请稍后重试。');
  await expect(page.getByRole('button', { name: '更新密码' })).toBeVisible();
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
