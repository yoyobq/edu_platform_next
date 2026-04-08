import type { Page, Route } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

type InviteStatusReason = 'AVAILABLE' | 'CONSUMED' | 'EXPIRED' | 'INVALID';
type TransportFailureKind = 'graphql' | 'http' | 'network';

function getGraphQLPayload(route: Route) {
  return route.request().postDataJSON() as
    | {
        query?: string;
        variables?: {
          input?: Record<string, unknown>;
          sessionToken?: string;
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

async function fulfillTransportFailure(route: Route, kind: TransportFailureKind, message: string) {
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

  await fulfillGraphQL(route, {
    errors: [{ message }],
  });
}

async function mockStaffInviteInfo(
  page: Page,
  options?: {
    inviteMessage?: string;
    invitedEmail?: string;
    statusReason?: InviteStatusReason;
    success?: boolean;
  },
) {
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (!query.includes('query PublicInviteInfo')) {
      await route.fallback();
      return;
    }

    const statusReason = options?.statusReason ?? 'AVAILABLE';

    await fulfillGraphQL(route, {
      data: {
        publicInviteInfo: {
          info:
            statusReason === 'INVALID'
              ? null
              : {
                  canProceed: statusReason === 'AVAILABLE',
                  description: '请完成上游身份核对后继续邀请注册。',
                  expiresAt: '2026-04-30T03:00:00.000Z',
                  invitedEmail: options?.invitedEmail ?? 'invitee@example.com',
                  issuer: '系统管理员',
                  statusReason,
                  title: '教职工邀请',
                  type: 'INVITE_STAFF',
                },
          message: options?.inviteMessage ?? null,
          reason: statusReason === 'INVALID' ? 'INVALID' : null,
          success: options?.success ?? statusReason === 'AVAILABLE',
        },
      },
    });
  });
}

async function mockStaffInviteFlow(
  page: Page,
  options?: {
    consumeFailureMessage?: string;
    consumeTransportFailure?: {
      kind: TransportFailureKind;
      message: string;
    };
    consumeSuccess?: boolean;
    identityMessage?: string;
    identityTransportFailure?: boolean;
    invitedEmail?: string;
    loginMessage?: string;
    loginTransportFailure?: boolean;
  },
) {
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicInviteInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicInviteInfo: {
            info: {
              canProceed: true,
              description: '请完成上游身份核对后继续邀请注册。',
              expiresAt: '2026-04-30T03:00:00.000Z',
              invitedEmail: options?.invitedEmail ?? 'invitee@example.com',
              issuer: '系统管理员',
              statusReason: 'AVAILABLE',
              title: '教职工邀请',
              type: 'INVITE_STAFF',
            },
            message: null,
            reason: null,
            success: true,
          },
        },
      });
      return;
    }

    if (query.includes('mutation LoginUpstreamSession')) {
      if (options?.loginTransportFailure) {
        await fulfillGraphQL(route, {
          errors: [
            {
              message: options.loginMessage || '上游账号或密码不正确，请重新核对。',
              extensions: {
                code: 'BAD_USER_INPUT',
                errorCode: 'UPSTREAM_ACCESS_AUTH_FAILED',
                errorMessage: options.loginMessage || '上游账号或密码不正确，请重新核对。',
              },
            },
          ],
        });
        return;
      }

      await fulfillGraphQL(route, {
        data: {
          loginUpstreamSession: {
            expiresAt: '2026-04-09T03:10:00.000Z',
            upstreamSessionToken: 'upstream-session-001',
          },
        },
      });
      return;
    }

    if (query.includes('query FetchVerifiedStaffIdentity')) {
      if (options?.identityTransportFailure) {
        await fulfillGraphQL(route, {
          errors: [
            {
              message: options.identityMessage || '暂时无法确认教职工身份，请稍后重试。',
              extensions: {
                code: 'BAD_USER_INPUT',
                errorCode: 'UPSTREAM_ACCESS_UPSTREAM_BIZ_ERROR',
                errorMessage: options.identityMessage || '暂时无法确认教职工身份，请稍后重试。',
              },
            },
          ],
        });
        return;
      }

      await fulfillGraphQL(route, {
        data: {
          fetchVerifiedStaffIdentity: {
            expiresAt: '2026-04-09T03:15:00.000Z',
            identityKind: 'STAFF',
            orgId: 'staff-department-001',
            personId: 'staff-001',
            personName: 'Alice Teacher',
            upstreamLoginId: 'teacher.alice',
            upstreamSessionToken: 'verified-session-001',
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeStaffInvite')) {
      if (options?.consumeTransportFailure) {
        await fulfillTransportFailure(
          route,
          options.consumeTransportFailure.kind,
          options.consumeTransportFailure.message,
        );
        return;
      }

      await fulfillGraphQL(route, {
        data: {
          consumeVerificationFlowPublic: {
            accountId: options?.consumeSuccess === false ? null : 9527,
            message: options?.consumeFailureMessage || '邀请注册成功',
            success: options?.consumeSuccess ?? true,
          },
        },
      });
      return;
    }

    await route.fallback();
  });
}

test('有效 staff invite 应可完成预览、上游核对与注册消费，且不传 loginEmail', async ({ page }) => {
  let consumeInput: Record<string, unknown> | null = null;

  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicInviteInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicInviteInfo: {
            info: {
              canProceed: true,
              description: '请完成上游身份核对后继续邀请注册。',
              expiresAt: '2026-04-30T03:00:00.000Z',
              invitedEmail: 'invitee@example.com',
              issuer: '系统管理员',
              statusReason: 'AVAILABLE',
              title: '教职工邀请',
              type: 'INVITE_STAFF',
            },
            message: null,
            reason: null,
            success: true,
          },
        },
      });
      return;
    }

    if (query.includes('mutation LoginUpstreamSession')) {
      await fulfillGraphQL(route, {
        data: {
          loginUpstreamSession: {
            expiresAt: '2026-04-09T03:10:00.000Z',
            upstreamSessionToken: 'upstream-session-001',
          },
        },
      });
      return;
    }

    if (query.includes('query FetchVerifiedStaffIdentity')) {
      await fulfillGraphQL(route, {
        data: {
          fetchVerifiedStaffIdentity: {
            expiresAt: '2026-04-09T03:15:00.000Z',
            identityKind: 'STAFF',
            orgId: 'staff-department-001',
            personId: 'staff-001',
            personName: 'Alice Teacher',
            upstreamLoginId: 'teacher.alice',
            upstreamSessionToken: 'verified-session-001',
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeStaffInvite')) {
      consumeInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          consumeVerificationFlowPublic: {
            accountId: 9527,
            message: '邀请注册成功',
            success: true,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.invite('staff', 'staff-invite-001'));

  await expect(page.getByRole('heading', { name: '教职工邀请激活' })).toBeVisible();
  await expect(page.getByText('invitee@example.com')).toBeVisible();

  await page.getByRole('button', { name: '继续身份核对' }).click();
  await page.getByLabel('上游账号').fill('teacher.alice');
  await page.getByLabel('上游密码').fill('Password!123');
  await page.getByRole('button', { name: '核对教职工身份' }).click();

  await expect(page.getByText('设置账户信息')).toBeVisible();
  await expect(page.locator('input[value="invitee@example.com"]')).toHaveAttribute('readonly', '');
  await expect(page.locator('input[value="Alice Teacher"]')).toHaveAttribute('readonly', '');
  await expect(page.locator('input[value="staff-department-001"]')).toHaveAttribute('readonly', '');

  await page.getByLabel('昵称').fill('Alice');
  await page.locator('input#loginPassword').fill('Invite!234');
  await page.locator('input#confirmPassword').fill('Invite!234');
  await page.getByRole('button', { name: '完成邀请注册' }).click();

  await expect(page.getByText('邀请注册已完成')).toBeVisible();
  await expect(page.getByRole('button', { name: '返回登录' })).toBeVisible();

  expect(consumeInput).not.toBeNull();
  expect(consumeInput).toMatchObject({
    expectedType: 'INVITE_STAFF',
    loginPassword: 'Invite!234',
    nickname: 'Alice',
    staffDepartmentId: 'staff-department-001',
    staffName: 'Alice Teacher',
    token: 'staff-invite-001',
    upstreamSessionToken: 'verified-session-001',
  });
  expect(consumeInput).not.toHaveProperty('loginEmail');
  expect(consumeInput).not.toHaveProperty('loginName');

  await page.getByRole('button', { name: '返回登录' }).click();
  await expect(page).toHaveURL(routes.login + '?skipRestore=1');
});

for (const inviteCase of [
  {
    title: '已过期 invite 应显示失败态',
    statusReason: 'EXPIRED' as const,
    message: '这个邀请链接已经过期，请联系管理员重新发起邀请。',
    expectedTitle: '邀请已过期',
  },
  {
    title: '已使用 invite 应显示失败态',
    statusReason: 'CONSUMED' as const,
    message: '这个邀请链接已经被使用，无法继续完成教职工邀请注册。',
    expectedTitle: '邀请已使用',
  },
  {
    title: '无效 invite 应显示失败态',
    statusReason: 'INVALID' as const,
    message: '这个邀请链接无效，请确认链接是否完整。',
    expectedTitle: '邀请不可用',
  },
]) {
  test(inviteCase.title, async ({ page }) => {
    await mockStaffInviteInfo(page, {
      inviteMessage: inviteCase.statusReason === 'INVALID' ? inviteCase.message : undefined,
      statusReason: inviteCase.statusReason,
      success: false,
    });

    await page.goto(routes.invite('staff', 'invite-unavailable-001'));

    await expect(page.getByText(inviteCase.expectedTitle)).toBeVisible();
    await expect(page.getByText(inviteCase.message)).toBeVisible();
    await expect(page.getByRole('button', { name: '返回登录' })).toBeVisible();
  });
}

test('上游账号校验失败时应提示明确错误且停留在身份核对阶段', async ({ page }) => {
  await mockStaffInviteFlow(page, {
    loginMessage: '上游账号或密码不正确，请重新核对。',
    loginTransportFailure: true,
  });

  await page.goto(routes.invite('staff', 'staff-invite-login-failed'));
  await page.getByRole('button', { name: '继续身份核对' }).click();
  await page.getByLabel('上游账号').fill('teacher.alice');
  await page.getByLabel('上游密码').fill('wrong-password');
  await page.getByRole('button', { name: '核对教职工身份' }).click();

  await expect(page.getByText('上游账号或密码不正确，请重新核对。')).toBeVisible();
  await expect(page.getByRole('button', { name: '核对教职工身份' })).toBeVisible();
});

test('最终提交返回邮箱已占用时应进入明确失败态', async ({ page }) => {
  await mockStaffInviteFlow(page, {
    consumeFailureMessage: '邀请邮箱已被注册，请直接返回登录页或联系管理员处理。',
    consumeSuccess: false,
  });

  await page.goto(routes.invite('staff', 'staff-invite-email-taken'));
  await page.getByRole('button', { name: '继续身份核对' }).click();
  await page.getByLabel('上游账号').fill('teacher.alice');
  await page.getByLabel('上游密码').fill('Password!123');
  await page.getByRole('button', { name: '核对教职工身份' }).click();
  await page.getByLabel('昵称').fill('Alice');
  await page.locator('input#loginPassword').fill('Invite!234');
  await page.locator('input#confirmPassword').fill('Invite!234');
  await page.getByRole('button', { name: '完成邀请注册' }).click();

  await expect(page.getByText('邀请注册未完成')).toBeVisible();
  await expect(
    page.getByText('邀请邮箱已被注册，请直接返回登录页或联系管理员处理。'),
  ).toBeVisible();
});

test('最终提交返回身份不匹配时应进入明确失败态', async ({ page }) => {
  await mockStaffInviteFlow(page, {
    consumeFailureMessage: '当前教职工身份与邀请不一致，该邀请已不可继续使用。',
    consumeSuccess: false,
  });

  await page.goto(routes.invite('staff', 'staff-invite-mismatch'));
  await page.getByRole('button', { name: '继续身份核对' }).click();
  await page.getByLabel('上游账号').fill('teacher.alice');
  await page.getByLabel('上游密码').fill('Password!123');
  await page.getByRole('button', { name: '核对教职工身份' }).click();
  await page.getByLabel('昵称').fill('Alice');
  await page.locator('input#loginPassword').fill('Invite!234');
  await page.locator('input#confirmPassword').fill('Invite!234');
  await page.getByRole('button', { name: '完成邀请注册' }).click();

  await expect(page.getByText('邀请注册未完成')).toBeVisible();
  await expect(page.getByText('当前教职工身份与邀请不一致，该邀请已不可继续使用。')).toBeVisible();
});

test('最终提交出现 transport 失败时应停留在表单阶段并显示统一错误', async ({ page }) => {
  await mockStaffInviteFlow(page, {
    consumeTransportFailure: {
      kind: 'http',
      message: 'INVITE_CONSUME_GATEWAY_DOWN',
    },
  });

  await page.goto(routes.invite('staff', 'staff-invite-transport-failed'));
  await page.getByRole('button', { name: '继续身份核对' }).click();
  await page.getByLabel('上游账号').fill('teacher.alice');
  await page.getByLabel('上游密码').fill('Password!123');
  await page.getByRole('button', { name: '核对教职工身份' }).click();
  await page.getByLabel('昵称').fill('Alice');
  await page.locator('input#loginPassword').fill('Invite!234');
  await page.locator('input#confirmPassword').fill('Invite!234');
  await page.getByRole('button', { name: '完成邀请注册' }).click();

  await expect(page.getByText('服务暂时不可用，请稍后重试。')).toBeVisible();
  await expect(page.getByRole('button', { name: '完成邀请注册' })).toBeVisible();
});

test('已有本地 session 时 staff invite 真实流程不应主动触发 me 或 refresh', async ({ page }) => {
  let meRequestCount = 0;
  let refreshRequestCount = 0;

  await mockApiHealth(page);
  await seedAuthSession(page, {
    displayName: 'stale-admin',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query Me')) {
      meRequestCount += 1;
      await fulfillGraphQL(route, {
        data: {
          me: null,
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

    if (query.includes('query PublicInviteInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicInviteInfo: {
            info: {
              canProceed: true,
              description: '请完成上游身份核对后继续邀请注册。',
              expiresAt: '2026-04-30T03:00:00.000Z',
              invitedEmail: 'invitee@example.com',
              issuer: '系统管理员',
              statusReason: 'AVAILABLE',
              title: '教职工邀请',
              type: 'INVITE_STAFF',
            },
            message: null,
            reason: null,
            success: true,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.invite('staff', 'staff-invite-001'));

  await expect(page.getByRole('heading', { name: '教职工邀请激活' })).toBeVisible();
  await expect(page.getByText('invitee@example.com')).toBeVisible();
  expect(meRequestCount).toBe(0);
  expect(refreshRequestCount).toBe(0);
});
