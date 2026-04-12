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
      gender: 'SECRET',
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

function buildDepartmentsPayload() {
  return {
    departments: [
      {
        departmentName: '人工智能系',
        id: 'd-lambda',
        isEnabled: true,
        shortName: 'AI',
      },
      {
        departmentName: '数学系',
        id: 'd-math',
        isEnabled: true,
        shortName: 'Math',
      },
    ],
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

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
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

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
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

test('account 常用字段应支持分区编辑与保存', async ({ page }) => {
  const accountId = 1011;
  const detailPayload = buildAdminUserDetailPayload(accountId);
  const staffPayload = buildAdminUserStaffPayload(accountId);

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
        data: detailPayload,
      });
      return;
    }

    if (query.includes('query AdminUserDetailStaff(')) {
      await fulfillGraphQL(route, {
        data: staffPayload,
      });
      return;
    }

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
      });
      return;
    }

    if (query.includes('mutation BatchUpdateAccountStatus')) {
      detailPayload.account.status = 'SUSPENDED';
      detailPayload.account.updatedAt = '2026-04-14T08:00:00.000Z';

      await fulfillGraphQL(route, {
        data: {
          batchUpdateAccountStatus: {
            accounts: [
              {
                id: accountId,
                identityHint: detailPayload.account.identityHint,
                loginEmail: detailPayload.account.loginEmail,
                loginName: detailPayload.account.loginName,
                status: detailPayload.account.status,
                updatedAt: detailPayload.account.updatedAt,
              },
            ],
            isUpdated: true,
          },
        },
      });
      return;
    }

    if (query.includes('mutation UpdateIdentityHint')) {
      detailPayload.account.identityHint = 'ADMIN';

      await fulfillGraphQL(route, {
        data: {
          updateIdentityHint: {
            accountId,
            identityHint: 'ADMIN',
            isUpdated: true,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await expect(page.getByText('人工智能系')).toBeVisible();
  await page.getByRole('button', { name: '编辑账户常用字段' }).click();

  await expect(page.getByText('当前暂不支持修改。')).toBeVisible();
  await page.locator('#account-section-form').getByText('已暂停').click();
  await page.locator('#account-section-form').getByText('ADMIN').click();
  await page.getByRole('button', { name: '保存账户常用字段' }).click();

  await expect(page.getByRole('button', { name: '编辑账户常用字段' })).toBeVisible();
  await expect(page.getByText('已暂停', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('ADMIN', { exact: true }).first()).toBeVisible();
});

test('tags 应支持按数组项增删并以数组提交', async ({ page }) => {
  const accountId = 1011;
  const detailPayload = buildAdminUserDetailPayload(accountId);
  let submittedTags: string[] | null = null;

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
        data: detailPayload,
      });
      return;
    }

    if (query.includes('query AdminUserDetailStaff(')) {
      await fulfillGraphQL(route, {
        data: buildAdminUserStaffPayload(accountId),
      });
      return;
    }

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
      });
      return;
    }

    if (query.includes('mutation UpdateUserInfo')) {
      const payload = route.request().postDataJSON() as
        | {
            variables?: {
              input?: {
                tags?: unknown;
              };
            };
          }
        | undefined;

      submittedTags = Array.isArray(payload?.variables?.input?.tags)
        ? payload.variables.input.tags.filter((tag): tag is string => typeof tag === 'string')
        : null;
      detailPayload.userInfo.tags = submittedTags;
      detailPayload.userInfo.updatedAt = '2026-04-14T09:00:00.000Z';

      await fulfillGraphQL(route, {
        data: {
          updateUserInfo: {
            isUpdated: true,
            userInfo: detailPayload.userInfo,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await page.getByRole('button', { name: '编辑用户常用字段' }).click();
  await page.getByLabel('删除标签 formal').click();
  await page.getByRole('button', { name: '新增标签' }).click();
  await page.getByLabel('标签输入').fill('好人，热情');
  await page.getByRole('button', { name: '保存用户常用字段' }).click();

  await expect(page.getByText('好人', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('热情', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('formal', { exact: true })).toHaveCount(0);
  expect(submittedTags).toEqual(['好人', '热情']);
});

test('无标签时新增标签按钮不应禁用', async ({ page }) => {
  const accountId = 1011;
  const detailPayload = buildAdminUserDetailPayload(accountId);
  detailPayload.userInfo.tags = [];

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
        data: detailPayload,
      });
      return;
    }

    if (query.includes('query AdminUserDetailStaff(')) {
      await fulfillGraphQL(route, {
        data: buildAdminUserStaffPayload(accountId),
      });
      return;
    }

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await page.getByRole('button', { name: '编辑用户常用字段' }).click();
  await expect(page.getByRole('button', { name: '新增标签' })).toBeEnabled();
  await page.getByRole('button', { name: '新增标签' }).click();
  await expect(page.getByLabel('标签输入')).toBeVisible();
});

test('userInfo 保存失败时应在分区内显示错误并保留编辑态', async ({ page }) => {
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

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
      });
      return;
    }

    if (query.includes('mutation UpdateUserInfo')) {
      await fulfillGraphQLError(route, 'USER_STATE_FORBIDDEN');
      return;
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await page.getByRole('button', { name: '编辑用户常用字段' }).click();
  await page.getByText('已暂停').click();
  await page.getByRole('button', { name: '保存用户常用字段' }).click();

  await expect(page.getByText('USER_STATE_FORBIDDEN')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存用户常用字段' })).toBeVisible();
});

test('accessGroup 标签应满足 admin staff 可并存且 guest 互斥', async ({ page }) => {
  const accountId = 1011;
  const detailPayload = buildAdminUserDetailPayload(accountId);

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
        data: detailPayload,
      });
      return;
    }

    if (query.includes('query AdminUserDetailStaff(')) {
      await fulfillGraphQL(route, {
        data: buildAdminUserStaffPayload(accountId),
      });
      return;
    }

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
      });
      return;
    }

    if (query.includes('mutation UpdateUserInfo')) {
      await fulfillGraphQL(route, {
        data: {
          updateUserInfo: {
            isUpdated: true,
            userInfo: detailPayload.userInfo,
          },
        },
      });
      return;
    }

    if (query.includes('mutation UpdateAccessGroup')) {
      detailPayload.account.identityHint = 'GUEST';
      detailPayload.userInfo.accessGroup = ['GUEST'];

      await fulfillGraphQL(route, {
        data: {
          updateAccessGroup: {
            accessGroup: ['GUEST'],
            accountId,
            identityHint: 'GUEST',
            isUpdated: true,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await page.getByRole('button', { name: '编辑用户常用字段' }).click();

  const adminTag = page.getByTestId('access-group-tag-ADMIN');
  const staffTag = page.getByTestId('access-group-tag-STAFF');
  const guestTag = page.getByTestId('access-group-tag-GUEST');

  await expect(staffTag).toHaveAttribute('aria-pressed', 'true');
  await expect(adminTag).toHaveAttribute('aria-pressed', 'false');
  await expect(guestTag).toHaveAttribute('aria-pressed', 'false');

  await adminTag.click();
  await expect(adminTag).toHaveAttribute('aria-pressed', 'true');
  await expect(staffTag).toHaveAttribute('aria-pressed', 'true');

  await guestTag.click();
  await expect(guestTag).toHaveAttribute('aria-pressed', 'true');
  await expect(adminTag).toHaveAttribute('aria-pressed', 'false');
  await expect(staffTag).toHaveAttribute('aria-pressed', 'false');
});

test('registrant 访问组应只读展示且不允许前端修改', async ({ page }) => {
  const accountId = 1011;
  const detailPayload = buildAdminUserDetailPayload(accountId);
  detailPayload.userInfo.accessGroup = ['REGISTRANT'];

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
        data: detailPayload,
      });
      return;
    }

    if (query.includes('query AdminUserDetailStaff(')) {
      await fulfillGraphQL(route, {
        data: buildAdminUserStaffPayload(accountId),
      });
      return;
    }

    if (query.includes('query AdminDepartments')) {
      await fulfillGraphQL(route, {
        data: buildDepartmentsPayload(),
      });
      return;
    }

    if (query.includes('mutation UpdateAccessGroup')) {
      throw new Error('REGISTRANT 不应触发 updateAccessGroup');
    }

    await route.fallback();
  });

  await page.goto(`/admin/users/${accountId}`);

  await expect(page.getByText('REGISTRANT', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '编辑用户常用字段' }).click();
  await expect(page.getByText('当前含 REGISTRANT，前端不支持修改访问组。')).toBeVisible();
  await expect(page.getByTestId('access-group-tag-ADMIN')).toHaveCount(0);
});
