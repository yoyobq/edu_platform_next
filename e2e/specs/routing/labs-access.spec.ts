import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import {
  AUTH_STORAGE_KEY,
  ensureFullNavigation,
  mockApiHealth,
  mockAuthGraphQL,
  seedAuthSession,
} from '../../helpers/app';
import { expect, test } from '../../test';

const UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.upstream.session.v2';
const LEGACY_UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.labs.upstream-session-demo.v1';

function createJwtWithExpOffsetMs(offsetMs: number) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor((Date.now() + offsetMs) / 1000),
    }),
  ).toString('base64url');

  return `${header}.${payload}.signature`;
}

async function replaceStoredAccessToken(page: Page, accessToken: string) {
  await page.addInitScript(
    ({ accessToken: nextAccessToken, storageKey }) => {
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        throw new Error('missing auth session');
      }

      const parsed = JSON.parse(raw) as {
        accessToken: string;
      };

      parsed.accessToken = nextAccessToken;
      window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    },
    {
      accessToken,
      storageKey: AUTH_STORAGE_KEY,
    },
  );
}

async function activateTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).evaluate((element) => {
    (element as HTMLElement).click();
  });
}

test('已登录但不具备 admin 权限时，应继续拦截 labs 示例页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('已登录但不具备 admin 权限时，应拦截 admin 认证码签发', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.adminVerificationIssuance);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('具备 admin 权限的已登录会话，应允许进入 labs 示例页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});

test('具备 admin 权限的已登录会话，应允许进入 labs invite issuer', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.labsInviteIssuer);

  await expect(page.getByRole('heading', { name: '临时邀请签发页' })).toBeVisible();
  await expect(page.getByRole('button', { name: '签发邀请' })).toBeVisible();
});

test('具备 admin 权限的已登录会话，应允许进入 admin 认证码签发', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query StaffDirectory')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            staffDirectory: {
              cacheExpiresAt: '2026-05-04T12:00:00.000Z',
              cacheStatus: 'FRESH',
              fetchedAt: '2026-05-04T10:00:00.000Z',
              teacherCount: 1,
              teachers: [{ name: '张老师', staffId: 'T001' }],
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

  await page.goto(routes.adminVerificationIssuance);

  await expect(page.getByRole('heading', { name: '认证码签发' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '教职工邀请' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '老用户回归' })).toBeVisible();
});

test('旧 labs 认证码签发路径应不再可访问', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto('/labs/issue-mail');

  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});

test('旧 labs 登录邮箱变更路径应不再可访问', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto('/labs/change-login-email');

  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});

test('旧 labs 课表视图路径应不再可访问', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto('/labs/academic-timetable');

  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});

test('旧 labs 授课计划首页路径应不再可访问', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto('/labs/curriculum-plan-homepage');

  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});

test('具备 staff 权限的已登录会话，不应继续访问 admin 专属 labs upstream session demo', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.labsUpstreamSessionDemo);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('具备 staff 权限的已登录会话，不应继续访问 admin 专属 labs invite issuer', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.labsInviteIssuer);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('labs upstream session demo 可登录 upstream、读取教师字典并滚动更新本地 token', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  let fetchTeacherDirectoryCount = 0;
  let fetchCurriculumPlanListCount = 0;
  let fetchVerifiedStaffIdentityCount = 0;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            sessionToken?: string;
          };
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation LoginUpstreamSession')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            loginUpstreamSession: {
              expiresAt: '2026-05-01T08:00:00.000Z',
              upstreamSessionToken: 'upstream-session-token-001',
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query FetchTeacherDirectory')) {
      fetchTeacherDirectoryCount += 1;

      await route.fulfill({
        body: JSON.stringify({
          data: {
            fetchTeacherDirectory: {
              expiresAt: '2026-05-01T09:00:00.000Z',
              teachers: [
                {
                  code: 'T-001',
                  image: '',
                  name: 'Alice Zhang',
                  text: 'Alice Zhang / T-001',
                  value: 'teacher-001',
                },
              ],
              upstreamSessionToken: `upstream-session-token-00${fetchTeacherDirectoryCount + 1}`,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (
      query.includes('query FetchDepartmentCurriculumPlanList') ||
      query.includes('query FetchCurriculumPlanList')
    ) {
      fetchCurriculumPlanListCount += 1;
      const responseKey = query.includes('query FetchDepartmentCurriculumPlanList')
        ? 'fetchDepartmentCurriculumPlanList'
        : 'fetchCurriculumPlanList';

      await route.fulfill({
        body: JSON.stringify({
          data: {
            [responseKey]: {
              count: 2,
              expiresAt: '2026-05-01T11:00:00.000Z',
              plans: [
                {
                  courseCode: 'CS101',
                  courseName: 'Programming Basics',
                },
                {
                  courseCode: 'CS102',
                  courseName: 'Data Structures',
                },
              ],
              upstreamSessionToken: `upstream-session-token-00${fetchTeacherDirectoryCount + fetchVerifiedStaffIdentityCount + fetchCurriculumPlanListCount + 1}`,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query FetchVerifiedStaffIdentity')) {
      fetchVerifiedStaffIdentityCount += 1;

      await route.fulfill({
        body: JSON.stringify({
          data: {
            fetchVerifiedStaffIdentity: {
              departmentName: '信息工程学院',
              expiresAt: '2026-05-01T10:00:00.000Z',
              identityKind: 'STAFF_TEACHER',
              orgId: 'org-001',
              personId: 'person-001',
              personName: 'Alice Zhang',
              upstreamLoginId: 'teacher.alice',
              upstreamSessionToken: `upstream-session-token-00${fetchTeacherDirectoryCount + fetchVerifiedStaffIdentityCount + 1}`,
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

  await page.goto(routes.labsUpstreamSessionDemo);
  await expect(
    page.getByText('本页面用于演示与上游系统 (Upstream) 的会话集成与数据交互。'),
  ).toBeVisible();

  await activateTab(page, '教师字典');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByPlaceholder('学号或工号').fill('teacher.alice');
  await page.getByPlaceholder('校园网登录密码').fill('secret-password');
  await page.getByRole('button', { name: '授权并继续' }).click();

  await expect(page.getByText('"value": "teacher-001"')).toBeVisible();
  await expect(page.getByText('预览条数：1')).toBeVisible();

  await activateTab(page, '教职工身份');
  await expect(page.getByText('姓名：Alice Zhang')).toBeVisible();
  await expect(page.getByText('"identityKind": "STAFF_TEACHER"')).toBeVisible();

  await activateTab(page, '系部教学计划');
  await page.getByLabel('学年').fill('2026');
  await page.getByLabel('学期').fill('1');
  await page.getByRole('button', { name: /^查\s*询$/ }).click();
  await expect(page.getByText('计划总数：2')).toBeVisible();
  await expect(page.getByText('返回条数：2')).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate((storageKey) => {
        const raw = window.localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw).upstreamSessionToken : null;
      }, UPSTREAM_SESSION_STORAGE_KEY),
    )
    .toBe('upstream-session-token-004');

  await page.reload();

  await expect(page.getByText('teacher.alice').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '登录 upstream' })).toHaveCount(0);
  await activateTab(page, '教师字典');
  await expect(page.getByText('"value": "teacher-001"')).toBeVisible();
  await expect(page.getByRole('tab', { name: '系部教学计划' })).toBeVisible();
});

test('labs upstream session demo 遇到跨账号残留 token 时，应清空旧 token 并要求重新登录', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 1001,
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    accountId: 1001,
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });
  await page.addInitScript(
    ({ key }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          accountId: 9527,
          expiresAt: '2026-05-01T08:00:00.000Z',
          upstreamLoginId: 'admin-user',
          upstreamSessionToken: 'stale-upstream-token',
          version: 1,
        }),
      );
    },
    {
      key: LEGACY_UPSTREAM_SESSION_STORAGE_KEY,
    },
  );

  await page.goto(routes.labsUpstreamSessionDemo);

  await expect(page.getByRole('button', { name: /^登\s*录$/ })).toBeVisible();
  await expect(page.getByText('stale-upstream-token')).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(
        (storageKey) => window.localStorage.getItem(storageKey),
        LEGACY_UPSTREAM_SESSION_STORAGE_KEY,
      ),
    )
    .toBeNull();
  await expect
    .poll(async () =>
      page.evaluate(
        (storageKey) => window.localStorage.getItem(storageKey),
        UPSTREAM_SESSION_STORAGE_KEY,
      ),
    )
    .toBeNull();
});

test('labs invite issuer 可签发 staff invite 并展示生成链接', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation InviteStaff')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            inviteStaff: {
              expiresAt: '2026-04-30T03:00:00.000Z',
              message: '邀请签发成功',
              recordId: 9527,
              success: true,
              token: 'staff-token-001',
              type: 'INVITE_STAFF',
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

  await page.goto(routes.labsInviteIssuer);

  await page.getByLabel('被邀请邮箱').fill('invitee@example.com');
  await page.getByLabel('教职工 ID').fill('staff-001');
  await page.getByRole('button', { name: '签发邀请' }).click();

  await expect(page.getByText('教职工邀请已签发')).toBeVisible();
  await expect(page.locator('text=staff-token-001').first()).toBeVisible();
  await expect(page.getByText('/invite/staff/staff-token-001')).toBeVisible();
});

test('labs invite issuer 可签发学生注册链接并展示后端返回链接', async ({ page }) => {
  let requestInput: { classCode?: string; studentId?: string } | null = null;

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            input?: { classCode?: string; studentId?: string };
          };
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation IssueStudentRegistrationLink')) {
      requestInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            issueStudentRegistrationLink: {
              success: true,
              link: 'https://frontend.example/invite/student-registration/student-register-token-001',
              token: 'student-register-token-001',
              recordId: 7001,
              expiresAt: '2026-06-30T03:00:00.000Z',
              classCode: '7020002',
              studentId: 'SRL000002',
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

  await page.goto(routes.labsInviteIssuer);

  await page.getByText('学生注册链接', { exact: true }).click();
  await page.getByLabel('班级代码').fill('7020002');
  await page.getByLabel('学生编号（可选）').fill('SRL000002');
  await page.getByRole('button', { name: '签发学生注册链接' }).click();

  await expect(page.getByText('学生注册链接已签发')).toBeVisible();
  await expect(page.getByText('student-register-token-001', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'https://frontend.example/invite/student-registration/student-register-token-001',
    ),
  ).toBeVisible();
  expect(requestInput).toEqual({
    classCode: '7020002',
    studentId: 'SRL000002',
  });
});

test('admin 认证码签发可从教师字典选择教师并发送邀请', async ({ page }) => {
  let requestInput: { invitedEmail?: string; staffId?: string } | null = null;

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            input?: { invitedEmail?: string; staffId?: string };
          };
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query StaffDirectory')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            staffDirectory: {
              cacheExpiresAt: '2026-05-04T12:00:00.000Z',
              cacheStatus: 'FRESH',
              fetchedAt: '2026-05-04T10:00:00.000Z',
              teacherCount: 2,
              teachers: [
                { name: '张老师', staffId: 'T001' },
                { name: '李老师', staffId: 'T002' },
              ],
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation InviteStaff')) {
      requestInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            inviteStaff: {
              expiresAt: '2026-05-05T00:00:00.000Z',
              message: '邀请邮件已发送',
              recordId: 101,
              success: true,
              token: 'invite-token-001',
              type: 'INVITE_STAFF',
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

  await page.goto(routes.adminVerificationIssuance);

  await page.getByLabel('教师姓名').fill('张');
  await page.getByText('张老师 (T001)').click();
  await expect(page.getByLabel('教师 ID')).toHaveValue('T001');
  await page.getByLabel('被邀请邮箱').fill('staff-invite@example.com');
  await page.getByRole('button', { name: '发送教职工邀请' }).click();

  await expect(page.getByText('教职工邀请已发送')).toBeVisible();
  expect(requestInput).toEqual({
    invitedEmail: 'staff-invite@example.com',
    staffId: 'T001',
  });
});

test('admin 认证码签发的教职工邀请失败时，应在教师区域展示友好错误', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query StaffDirectory')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            staffDirectory: {
              cacheExpiresAt: '2026-05-04T12:00:00.000Z',
              cacheStatus: 'FRESH',
              fetchedAt: '2026-05-04T10:00:00.000Z',
              teacherCount: 1,
              teachers: [{ name: '张老师', staffId: 'T001' }],
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation InviteStaff')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            inviteStaff: {
              expiresAt: null,
              message: 'staffId 已被使用',
              recordId: null,
              success: false,
              token: null,
              type: null,
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

  await page.goto(routes.adminVerificationIssuance);

  await page.getByLabel('教师姓名').fill('张');
  await page.getByText('张老师 (T001)').click();
  await page.getByLabel('被邀请邮箱').fill('staff-invite@example.com');
  await page.getByRole('button', { name: '发送教职工邀请' }).click();

  await expect(
    page.getByText('张老师（T001）已绑定或已被邀请，请确认是否选错教师。'),
  ).toBeVisible();
  await expect(page.getByText('发送失败')).toHaveCount(0);
});

test('admin 认证码签发可从 ADMIN/STAFF 用户列表发送回归改密邮件', async ({ page }) => {
  let requestInput: { accountId?: number } | null = null;

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
    adminUsersItems: [
      {
        account: {
          createdAt: '2026-05-01T00:00:00.000Z',
          id: 9527,
          identityHint: 'ADMIN',
          loginEmail: 'legacy@example.com',
          loginName: 'legacy-admin',
          status: 'ACTIVE',
        },
        staff: null,
        slotGroups: [],
        userInfo: {
          accessGroup: ['ADMIN'],
          avatarUrl: null,
          nickname: '老用户',
          phone: null,
          userState: 'ACTIVE',
        },
      },
    ],
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            input?: { accountId?: number };
          };
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query StaffDirectory')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            staffDirectory: {
              cacheExpiresAt: null,
              cacheStatus: 'MISS',
              fetchedAt: null,
              teacherCount: 0,
              teachers: [],
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation AdminRequestPasswordResetEmail')) {
      requestInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            adminRequestPasswordResetEmail: {
              message: '回归改密邮件已发送',
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

  await page.goto(routes.adminVerificationIssuance);
  await page.getByRole('tab', { name: '老用户回归' }).click();
  await page
    .getByRole('row', { name: /legacy@example\.com/ })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: '发送回归改密邮件' }).click();

  await expect(page.getByText('回归改密邮件已发送').first()).toBeVisible();
  expect(requestInput).toEqual({
    accountId: 9527,
  });
});

test('admin 认证码签发可从用户列表发送登录邮箱变更验证邮件', async ({ page }) => {
  let adminUsersVariables: Record<string, unknown> | null = null;
  let requestInput: { accountId?: number; newLoginEmail?: string } | null = null;

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
    adminUsersItems: [
      {
        account: {
          createdAt: '2026-05-01T00:00:00.000Z',
          id: 7001,
          identityHint: 'STUDENT',
          loginEmail: 'target@example.com',
          loginName: 'target-login',
          status: 'ACTIVE',
        },
        staff: null,
        slotGroups: [],
        userInfo: {
          accessGroup: ['STUDENT'],
          avatarUrl: null,
          nickname: '目标用户',
          phone: null,
          userState: 'ACTIVE',
        },
      },
    ],
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            input?: { accountId?: number; newLoginEmail?: string };
          } & Record<string, unknown>;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query StaffDirectory')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            staffDirectory: {
              cacheExpiresAt: null,
              cacheStatus: 'MISS',
              fetchedAt: null,
              teacherCount: 0,
              teachers: [],
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (
      query.includes('query AdminUsers') ||
      query.includes('query VerificationAccountPickerAdminUsers')
    ) {
      adminUsersVariables = payload?.variables ?? null;
      await route.fallback();
      return;
    }

    if (query.includes('mutation AdminRequestChangeLoginEmail')) {
      requestInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            adminRequestChangeLoginEmail: {
              message: '登录邮箱变更验证邮件已发送',
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

  await page.goto(routes.adminVerificationIssuance);
  await page.getByRole('tab', { name: '登录邮箱变更' }).click();
  await page
    .getByRole('row', { name: /target@example\.com/ })
    .getByRole('radio')
    .check();
  await page.getByRole('button', { name: '发送邮箱变更验证' }).click();
  await page.getByLabel('新的登录邮箱').fill('changed@example.com');
  await page.getByRole('button', { name: '发送验证邮件' }).click();

  await expect(page.getByText('登录邮箱变更验证已发送').first()).toBeVisible();
  expect(adminUsersVariables?.accessGroups).toBeUndefined();
  expect(adminUsersVariables?.limit).toBe(10);
  expect(requestInput).toEqual({
    accountId: 7001,
    newLoginEmail: 'changed@example.com',
  });
});

test('admin 认证码签发批量回归改密部分失败时，只保留失败项选中', async ({ page }) => {
  const requestAccountIds: number[] = [];

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
    adminUsersItems: [
      {
        account: {
          createdAt: '2026-05-01T00:00:00.000Z',
          id: 9527,
          identityHint: 'ADMIN',
          loginEmail: 'legacy-success@example.com',
          loginName: 'legacy-success',
          status: 'ACTIVE',
        },
        staff: null,
        slotGroups: [],
        userInfo: {
          accessGroup: ['ADMIN'],
          avatarUrl: null,
          nickname: '成功用户',
          phone: null,
          userState: 'ACTIVE',
        },
      },
      {
        account: {
          createdAt: '2026-05-01T00:00:00.000Z',
          id: 9528,
          identityHint: 'STAFF',
          loginEmail: 'legacy-failed@example.com',
          loginName: 'legacy-failed',
          status: 'ACTIVE',
        },
        staff: null,
        slotGroups: [],
        userInfo: {
          accessGroup: ['STAFF'],
          avatarUrl: null,
          nickname: '失败用户',
          phone: null,
          userState: 'ACTIVE',
        },
      },
    ],
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            input?: { accountId?: number };
          };
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query StaffDirectory')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            staffDirectory: {
              cacheExpiresAt: null,
              cacheStatus: 'MISS',
              fetchedAt: null,
              teacherCount: 0,
              teachers: [],
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation AdminRequestPasswordResetEmail')) {
      const accountId = payload?.variables?.input?.accountId;

      if (typeof accountId === 'number') {
        requestAccountIds.push(accountId);
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            adminRequestPasswordResetEmail: {
              message: accountId === 9528 ? '目标账号没有注册邮箱' : '回归改密邮件已发送',
              success: accountId !== 9528,
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

  await page.goto(routes.adminVerificationIssuance);
  await page.getByRole('tab', { name: '老用户回归' }).click();
  const successCheckbox = page
    .getByRole('row', { name: /legacy-success@example\.com/ })
    .getByRole('checkbox');
  const failedCheckbox = page
    .getByRole('row', { name: /legacy-failed@example\.com/ })
    .getByRole('checkbox');

  await successCheckbox.check();
  await failedCheckbox.check();
  await page.getByRole('button', { name: '发送回归改密邮件' }).click();

  await expect(page.getByText('部分发送失败')).toBeVisible();
  await expect(page.getByText('已完成 1 封，失败 1 封。')).toBeVisible();
  await expect(successCheckbox).not.toBeChecked();
  await expect(failedCheckbox).toBeChecked();
  expect(requestAccountIds).toEqual([9528, 9527]);
});

test('具备 admin 权限但 access token 临近过期时，进入 labs 示例页不应触发前置续期', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'stale-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });

  let refreshRequestCount = 0;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;

    if (typeof payload?.query === 'string' && payload.query.includes('mutation Refresh')) {
      refreshRequestCount += 1;
    }

    await route.fallback();
  });

  await seedAuthSession(page, {
    displayName: 'stale-admin',
    primaryAccessGroup: 'ADMIN',
  });
  await replaceStoredAccessToken(page, createJwtWithExpOffsetMs(30_000));

  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
  expect(refreshRequestCount).toBe(0);
});

test('待补全会话访问 labs 示例页时，应优先分流到 /welcome 而不是返回 403', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accessGroup: ['REGISTRANT'],
      displayName: 'pending-user',
      identity: null,
      identityHint: 'STUDENT',
      needsProfileCompletion: true,
      primaryAccessGroup: 'REGISTRANT',
    },
  });
  await seedAuthSession(page, {
    accessGroup: ['REGISTRANT'],
    displayName: 'pending-user',
    identity: null,
    identityHint: 'STUDENT',
    needsProfileCompletion: true,
    primaryAccessGroup: 'REGISTRANT',
  });

  await page.goto(`${routes.labsDemo}?mode=debug`);

  await expect(page).toHaveURL(
    new RegExp(`/welcome\\?redirect=${encodeURIComponent(`${routes.labsDemo}?mode=debug`)}$`),
  );
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});

test('仅工号 1/2 的管理员会在正式导航中看到载荷加解密入口并可进入', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 1,
      displayName: 'root-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    accountId: 1,
    displayName: 'root-admin',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.home);

  await ensureFullNavigation(page);
  await page.getByText('系统管理').click();
  await expect(page.getByText('载荷加解密')).toBeVisible();
  await page.getByText('载荷加解密').click();

  await expect(page).toHaveURL(new RegExp(`${routes.systemPayloadCrypto}$`));
  await expect(page.getByRole('heading', { name: '载荷加解密工具' })).toBeVisible();
});

test('载荷加解密应在本地记录历史，并允许调用历史输入载荷', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 1,
      displayName: 'root-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    accountId: 1,
    displayName: 'root-admin',
    primaryAccessGroup: 'ADMIN',
  });
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: Record<string, unknown> }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query DebugEncryptSstsPayload')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            debugEncryptSstsPayload: {
              encryptedData: 'encrypted-history-demo',
              operation: 'encrypt',
              plainTextData: { value: 'history-demo' },
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

  await page.goto(routes.systemPayloadCrypto);

  await expect(page.getByRole('heading', { name: '载荷加解密工具' })).toBeVisible();
  await expect(page.getByText('当前 ID：1')).toBeVisible();
  await expect(page.getByText('仅 ID 1 / 2 可访问')).toBeVisible();
  await page.getByRole('textbox').fill('{"value":"history-demo"}');
  await page.getByRole('button', { name: '查看结果' }).click();

  await expect(page.getByText('encrypted-history-demo')).toBeVisible();
  await expect(page.getByText('加解密历史')).toBeVisible();
  await expect(page.getByText('加密', { exact: true })).toBeVisible();
  await expect(page.getByTitle('{"value":"history-demo"}')).toBeVisible();

  await page.getByRole('button', { name: '重命名历史 1' }).click();
  await page.getByPlaceholder('输入历史名称').fill('登录接口样例');
  await page.getByPlaceholder('输入历史名称').press('Enter');
  await expect(page.getByText('登录接口样例')).toBeVisible();
  await expect(page.getByTitle('{"value":"history-demo"}')).toHaveCount(0);

  await page.getByRole('button', { name: '清空输入载荷' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('');
  await page.getByTestId('payload-history-use-0').click();
  await expect(page.getByRole('textbox')).toHaveValue('{"value":"history-demo"}');
  await expect(page.getByText('encrypted-history-demo')).toBeVisible();

  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.getByText('清空全部加解密历史？')).toBeVisible();
  await page.locator('.ant-popover').getByRole('button').first().click();
  await expect(page.getByText('登录接口样例')).toBeVisible();

  await page.getByRole('button', { name: '删除历史 1' }).click();
  await expect(page.getByText('删除历史“登录接口样例”？')).toBeVisible();
  await page.locator('.ant-popover').getByRole('button').last().click();
  await expect(page.getByText('登录接口样例')).toHaveCount(0);
});

test('其他管理员不应在正式导航中看到载荷加解密入口，且直接访问仍会返回 403', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 9527,
      displayName: 'normal-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    accountId: 9527,
    displayName: 'normal-admin',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.home);

  await ensureFullNavigation(page);
  await page.getByText('系统管理').click();
  await expect(page.getByText('载荷加解密')).toHaveCount(0);

  await page.goto(routes.systemPayloadCrypto);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('guest 直接访问载荷加解密稳定路径时，应保留 app layout 并显示 dark 模式下的 403', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('color-scheme', 'dark');
  });
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accessGroup: ['GUEST'],
      displayName: 'guest-user',
      identity: null,
      identityHint: 'GUEST',
      primaryAccessGroup: 'GUEST',
    },
  });
  await seedAuthSession(page, {
    accessGroup: ['GUEST'],
    displayName: 'guest-user',
    identity: null,
    identityHint: 'GUEST',
    primaryAccessGroup: 'GUEST',
  });

  await page.goto(routes.systemPayloadCrypto);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('旧 labs 载荷加解密路径应返回 404', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 1,
      displayName: 'root-admin',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    accountId: 1,
    displayName: 'root-admin',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.labsPayloadCrypto);

  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});

test('待补全会话直接访问载荷加解密页时，应优先进入 /welcome 而不是 404', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accessGroup: ['REGISTRANT'],
      accountId: 1,
      displayName: 'pending-admin-like-user',
      identity: null,
      identityHint: 'STAFF',
      needsProfileCompletion: true,
      primaryAccessGroup: 'REGISTRANT',
    },
  });
  await seedAuthSession(page, {
    accessGroup: ['REGISTRANT'],
    accountId: 1,
    displayName: 'pending-admin-like-user',
    identity: null,
    identityHint: 'STAFF',
    needsProfileCompletion: true,
    primaryAccessGroup: 'REGISTRANT',
  });

  await page.goto(`${routes.systemPayloadCrypto}?source=direct`);

  await expect(page).toHaveURL(
    new RegExp(
      `/welcome\\?redirect=${encodeURIComponent(`${routes.systemPayloadCrypto}?source=direct`)}$`,
    ),
  );
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});
