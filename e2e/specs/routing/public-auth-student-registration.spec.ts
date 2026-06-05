// e2e/specs/routing/public-auth-student-registration.spec.ts

import type { Route } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth } from '../../helpers/app';
import { expect, test } from '../../test';

function getGraphQLPayload(route: Route) {
  return route.request().postDataJSON() as
    | {
        query?: string;
        variables?: {
          input?: Record<string, unknown>;
          token?: string;
        };
      }
    | undefined;
}

async function fulfillGraphQL(route: Route, body: unknown) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

test('学生注册链接注册成功后应进入待验证登录邮箱状态并支持泛化重发', async ({ page }) => {
  let consumeInput: Record<string, unknown> | null = null;
  let resendInput: Record<string, unknown> | null = null;

  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: true,
            reason: 'AVAILABLE',
            message: null,
            info: {
              canProceed: true,
              status: 'ACTIVE',
              scope: 'CLASS',
              classCode: '1031301',
              className: '信息1301班',
              studentId: null,
              expiresAt: '2026-06-30T12:00:00.000Z',
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeStudentRegistrationLink')) {
      consumeInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          consumeStudentRegistrationLink: {
            success: true,
            message: '学生注册成功',
            accountId: 1001,
            loginEmail: 'student@example.com',
            accountStatus: 'PENDING',
            emailVerificationRequired: true,
            emailVerificationSent: false,
          },
        },
      });
      return;
    }

    if (query.includes('mutation ResendLoginEmailVerification')) {
      resendInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          resendLoginEmailVerification: {
            success: true,
            message: null,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-success-001'));

  await expect(page.getByRole('heading', { name: '学生注册' })).toBeVisible();
  await expect(page.getByText('信息1301班')).toBeVisible();
  await page.getByLabel('学生编号').fill('S001');
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('证件号后 6 位').fill('A12345');
  await page.getByLabel('登录邮箱').fill('student@example.com');
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByLabel('登录密码').fill('Abc12345!');
  await page.getByLabel('确认登录密码').fill('Abc12345!');
  await page.getByRole('button', { name: '提交注册' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '账号已创建' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '验证邮件发送失败' })).toBeVisible();
  await page.getByRole('button', { name: '重新发送验证邮件' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '如果账户需要验证' })).toBeVisible();

  expect(consumeInput).toEqual({
    token: 'student-register-success-001',
    studentId: 'S001',
    name: '张三',
    idCardLastSix: 'A12345',
    loginEmail: 'student@example.com',
    loginPassword: 'Abc12345!',
    loginName: 'stu001',
    nickname: '张三',
  });
  expect(resendInput).toEqual({
    loginEmail: 'student@example.com',
  });
});

test('指定学生注册链接应锁定学生编号', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: true,
            reason: 'AVAILABLE',
            message: null,
            info: {
              canProceed: true,
              status: 'ACTIVE',
              scope: 'STUDENT',
              classCode: '1031301',
              className: '信息1301班',
              studentId: 'S001',
              expiresAt: '2026-06-30T12:00:00.000Z',
            },
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-locked-001'));

  await expect(page.getByLabel('学生编号')).toHaveValue('S001');
  await expect(page.getByLabel('学生编号')).toBeDisabled();
});

test('学生注册链接不可用时不展示注册表单', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: false,
            reason: 'LINK_NOT_FOUND',
            message: '这个学生注册链接无效，请确认链接是否完整。',
            info: null,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('missing-register-link'));

  await expect(page.getByRole('alert')).toContainText('注册链接不可用');
  await expect(page.getByLabel('学生编号')).toHaveCount(0);
});

test('登录邮箱验证成功后应跳转登录页并预填登录邮箱', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation VerifyLoginEmail')) {
      await fulfillGraphQL(route, {
        data: {
          verifyLoginEmail: {
            success: true,
            message: '登录邮箱已验证',
            reason: null,
            accountId: 1001,
            loginEmail: 'student@example.com',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.verifyAccountEmail('verify-account-email-success-001'));

  await expect(page.getByRole('alert').filter({ hasText: '登录邮箱已验证' })).toBeVisible();
  await page.getByRole('button', { name: '前往登录' }).click();
  await expect(page).toHaveURL(/\/login\?skipRestore=1$/);
  await expect(page.getByLabel('登录名或邮箱')).toHaveValue('student@example.com');
});

test('登录邮箱验证失败应按 reason 展示失败态', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation VerifyLoginEmail')) {
      await fulfillGraphQL(route, {
        data: {
          verifyLoginEmail: {
            success: false,
            message: '这个登录邮箱验证链接已经过期，请重新发送验证邮件。',
            reason: 'EXPIRED',
            accountId: null,
            loginEmail: 'student@example.com',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.verifyAccountEmail('verify-account-email-expired-001'));

  await expect(page.getByRole('alert')).toContainText('验证链接已过期');
  await expect(page.getByRole('button', { name: '返回登录' })).toBeVisible();
});
