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
  let accountInput: Record<string, unknown> | null = null;
  let consumeInput: Record<string, unknown> | null = null;
  let identityInput: Record<string, unknown> | null = null;
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

    if (query.includes('mutation VerifyStudentRegistrationIdentity')) {
      identityInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationIdentity: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationAccount')) {
      accountInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationAccount: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
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

  await expect(page.getByRole('heading', { name: '信息1301班 学生注册' })).toBeVisible();
  await expect(page.getByText('班级代码')).toHaveCount(0);
  await expect(page.getByText('适用范围')).toHaveCount(0);
  await expect(page.getByText('过期时间')).toHaveCount(0);
  await expect(page.getByText('1031301')).toHaveCount(0);
  await expect(page.getByPlaceholder('请输入完整学号')).toBeVisible();
  await expect(page.getByText('例如：3130101XX')).toBeVisible();
  await page.getByLabel('学号').fill('S001');
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('身份证后 6 位').fill('A12345');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByLabel('昵称（可选）')).toHaveValue('张三');
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Abc12345!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Abc12345!');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录邮箱').fill('student@example.com');
  await page.getByRole('button', { name: '提交注册' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '账号已创建' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '验证邮件发送失败' })).toBeVisible();
  await page.getByRole('button', { name: '重新发送验证邮件' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '如果账户需要验证' })).toBeVisible();

  expect(identityInput).toEqual({
    token: 'student-register-success-001',
    studentId: 'S001',
    name: '张三',
    idCardLastSix: 'A12345',
  });
  expect(accountInput).toEqual({
    token: 'student-register-success-001',
    loginName: 'stu001',
    loginPassword: 'Abc12345!',
    nickname: '张三',
  });
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

test('账号预校验遇到链接失效时应刷新链接状态并进入整页失效态', async ({ page }) => {
  let linkInfoRequests = 0;

  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      linkInfoRequests += 1;

      if (linkInfoRequests === 1) {
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

      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: false,
            reason: 'LINK_NOT_ACTIVE',
            message: '学生注册链接不可用',
            info: {
              canProceed: false,
              status: 'CONSUMED',
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

    if (query.includes('mutation VerifyStudentRegistrationIdentity')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationIdentity: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationAccount')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationAccount: {
            success: false,
            canProceed: false,
            reason: 'LINK_NOT_ACTIVE',
            message: '学生注册链接不可用',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-consumed-during-account-001'));

  await expect(page.getByLabel('学号')).toHaveValue('S001');
  await expect(page.getByLabel('学号')).toBeDisabled();
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('身份证后 6 位').fill('A12345');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByLabel('昵称（可选）')).toHaveValue('张三');
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Abc12345!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Abc12345!');
  await page.getByRole('button', { name: '下一步' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '注册链接已使用' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '学生注册链接不可用' })).toBeVisible();
  await expect(page.getByLabel('登录邮箱')).toHaveCount(0);
  expect(linkInfoRequests).toBe(2);
});

test('最终提交遇到链接失效时应刷新链接状态并进入整页失效态', async ({ page }) => {
  let linkInfoRequests = 0;

  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      linkInfoRequests += 1;

      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo:
            linkInfoRequests === 1
              ? {
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
                }
              : {
                  success: false,
                  reason: 'LINK_NOT_ACTIVE',
                  message: '学生注册链接不可用',
                  info: {
                    canProceed: false,
                    status: 'CONSUMED',
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

    if (query.includes('mutation VerifyStudentRegistrationIdentity')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationIdentity: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationAccount')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationAccount: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeStudentRegistrationLink')) {
      await fulfillGraphQL(route, {
        errors: [
          {
            message: '学生注册链接不可用',
            extensions: {
              code: 'BAD_USER_INPUT',
              errorCode: 'STUDENT_REGISTRATION_LINK_NOT_ACTIVE',
              errorMessage: '学生注册链接不可用',
            },
          },
        ],
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-consumed-during-submit-001'));

  await expect(page.getByLabel('学号')).toHaveValue('S001');
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('身份证后 6 位').fill('A12345');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Abc12345!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Abc12345!');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录邮箱').fill('student@example.com');
  await page.getByRole('button', { name: '提交注册' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '注册链接已使用' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '学生注册链接不可用' })).toBeVisible();
  await expect(page.getByLabel('登录邮箱')).toHaveCount(0);
  expect(linkInfoRequests).toBe(2);
});

test('指定学生注册链接应锁定学号输入', async ({ page }) => {
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

  await expect(page.getByLabel('学号')).toHaveValue('S001');
  await expect(page.getByLabel('学号')).toBeDisabled();
  await expect(page.getByLabel('学生姓名')).toBeVisible();
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
  await expect(page.getByLabel('学号')).toHaveCount(0);
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
