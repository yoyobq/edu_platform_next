import type { Route } from '@playwright/test';

import { mockApiHealth, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

function getQuery(route: Route) {
  const payload = route.request().postDataJSON() as
    | { query?: string; variables?: Record<string, unknown> }
    | undefined;

  return typeof payload?.query === 'string' ? payload.query : '';
}

async function fulfillGraphQL(route: Route, body: unknown) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

async function fulfillGraphQLError(route: Route, message: string) {
  await fulfillGraphQL(route, {
    errors: [{ message }],
  });
}

function buildMePayload() {
  return {
    account: {
      id: 9527,
      identityHint: 'ADMIN',
      loginEmail: 'admin-user@example.com',
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
  };
}

function buildAdminUserDetailPayload(accountId: number) {
  return {
    account: {
      createdAt: '2026-04-01T08:00:00.000Z',
      id: accountId,
      identityHint: 'STAFF',
      loginEmail: 'staff.lambda@example.com',
      loginName: 'staff.lambda',
      recentLoginHistory: [
        {
          audience: 'web',
          ip: '127.0.0.1',
          timestamp: '2026-04-13T08:00:00.000Z',
        },
      ],
      status: 'ACTIVE',
      updatedAt: '2026-04-13T08:00:00.000Z',
    },
    userInfo: {
      accessGroup: ['STAFF'],
      address: null,
      avatarUrl: null,
      birthDate: null,
      createdAt: '2026-04-01T08:00:00.000Z',
      email: 'staff.lambda@example.com',
      gender: '保密',
      geographic: null,
      id: `user-info-${accountId}`,
      nickname: 'Lambda',
      notifyCount: 4,
      phone: '13800000011',
      signature: null,
      tags: ['formal'],
      unreadCount: 1,
      updatedAt: '2026-04-13T08:00:00.000Z',
      userState: 'ACTIVE',
    },
  };
}

function buildAdminUserStaffPayload(accountId: number) {
  return {
    staff: {
      accountId,
      createdAt: '2026-04-01T08:00:00.000Z',
      departmentId: 'd-lambda',
      employmentStatus: 'ACTIVE',
      id: `staff-${accountId}`,
      jobTitle: '辅导员',
      name: 'Lambda Xu',
      remark: '重点关注',
      updatedAt: '2026-04-13T08:00:00.000Z',
    },
  };
}

test('admin 用户详情页应渲染 staff 字段', async ({ page }) => {
  const accountId = 1011;

  await mockApiHealth(page);
  await seedAuthSession(page, {
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query Me')) {
      await fulfillGraphQL(route, { data: { me: buildMePayload() } });
      return;
    }

    if (query.includes('query AdminUserDetail(')) {
      await fulfillGraphQL(route, {
        data: buildAdminUserDetailPayload(accountId),
      });
      return;
    }

    if (query.includes('query AdminUserDetailStaff(')) {
      await fulfillGraphQL(route, {
        data: buildAdminUserStaffPayload(accountId),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await expect(page.getByRole('heading', { name: '用户详情' })).toBeVisible();
  await expect(page.getByText('staff-1011')).toBeVisible();
  await expect(page.getByText('Lambda Xu')).toBeVisible();
  await expect(page.getByText('辅导员')).toBeVisible();
});

test('staff resolver 报错时应显示失败态并允许重试', async ({ page }) => {
  const accountId = 1011;
  let staffQueryCount = 0;

  await mockApiHealth(page);
  await seedAuthSession(page, {
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query Me')) {
      await fulfillGraphQL(route, { data: { me: buildMePayload() } });
      return;
    }

    if (query.includes('query AdminUserDetail(')) {
      await fulfillGraphQL(route, {
        data: buildAdminUserDetailPayload(accountId),
      });
      return;
    }

    if (query.includes('query AdminUserDetailStaff(')) {
      staffQueryCount += 1;

      if (staffQueryCount === 1) {
        await fulfillGraphQLError(route, 'STAFF_RESOLVER_FAILED');
        return;
      }

      await fulfillGraphQL(route, {
        data: buildAdminUserStaffPayload(accountId),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await expect(page.getByText('用户详情加载失败')).toBeVisible();
  await expect(page.getByText('STAFF_RESOLVER_FAILED')).toBeVisible();
  await expect(page.getByText('当前账户暂无 staff 信息')).toHaveCount(0);

  await page.getByRole('button', { name: '重试' }).click();

  await expect(page.getByText('用户详情加载失败')).toHaveCount(0);
  await expect(page.getByText('Lambda Xu')).toBeVisible();
});
