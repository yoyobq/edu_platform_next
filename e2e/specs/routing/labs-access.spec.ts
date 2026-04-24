import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';
const UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.upstream.session.v2';
const LEGACY_UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.labs.upstream-session-demo.v1';

type AcademicSemesterSeed = {
  createdAt: string;
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  id: number;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
  updatedAt: string;
};

type AcademicCalendarEventSeed = {
  createdAt: string;
  dayPeriod: 'AFTERNOON' | 'ALL_DAY' | 'MORNING';
  eventDate: string;
  eventType: 'ACTIVITY' | 'EXAM' | 'HOLIDAY' | 'HOLIDAY_MAKEUP' | 'SPORTS_MEET' | 'WEEKDAY_SWAP';
  id: number;
  originalDate: string | null;
  recordStatus: 'ACTIVE' | 'EXPIRED' | 'TENTATIVE';
  ruleNote: string | null;
  semesterId: number;
  teachingCalcEffect: 'CANCEL' | 'MAKEUP' | 'NO_CHANGE' | 'SWAP';
  topic: string;
  updatedAt: string;
  updatedByAccountId: number | null;
  version: number;
};

function buildAcademicCalendarState() {
  const semesters: AcademicSemesterSeed[] = [
    {
      createdAt: '2026-04-01T00:00:00.000Z',
      endDate: '2026-07-10',
      examStartDate: '2026-06-22',
      firstTeachingDate: '2026-02-20',
      id: 101,
      isCurrent: true,
      name: '2025-2026 学年第二学期',
      schoolYear: 2025,
      startDate: '2026-02-17',
      termNumber: 2,
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
  ];
  const events: AcademicCalendarEventSeed[] = [
    {
      createdAt: '2026-04-05T00:00:00.000Z',
      dayPeriod: 'ALL_DAY',
      eventDate: '2026-04-20',
      eventType: 'SPORTS_MEET',
      id: 201,
      originalDate: null,
      recordStatus: 'ACTIVE',
      ruleNote: '春季活动安排',
      semesterId: 101,
      teachingCalcEffect: 'NO_CHANGE',
      topic: '春季运动会',
      updatedAt: '2026-04-06T00:00:00.000Z',
      updatedByAccountId: 9527,
      version: 1,
    },
  ];

  return { events, semesters };
}

async function mockAcademicCalendarGraphQL(page: Page) {
  const state = buildAcademicCalendarState();

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: Record<string, unknown>;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';
    const variables = payload?.variables ?? {};

    if (query.includes('query AcademicSemesters')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicSemesters: state.semesters,
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query AcademicCalendarEvents')) {
      const semesterId = Number(variables.semesterId ?? 0);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicCalendarEvents: state.events.filter((item) => item.semesterId === semesterId),
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

test('未登录访问 labs 示例页时，应先跳登录并保留原目标', async ({ page }) => {
  await page.goto(routes.labsDemo);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsDemo)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('未登录访问带查询参数的 labs 示例页时，应保留完整站内目标', async ({ page }) => {
  const target = `${routes.labsDemo}?mode=debug`;

  await page.goto(target);

  await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(target)}$`));
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('未登录访问 labs invite issuer 时，应先跳登录并保留原目标', async ({ page }) => {
  await page.goto(routes.labsInviteIssuer);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsInviteIssuer)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('未登录访问 labs change login email 时，应先跳登录并保留原目标', async ({ page }) => {
  await page.goto(routes.labsChangeLoginEmail);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsChangeLoginEmail)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('未登录访问 labs upstream session demo 时，应先跳登录并保留原目标', async ({ page }) => {
  await page.goto(routes.labsUpstreamSessionDemo);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsUpstreamSessionDemo)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('未登录访问 labs 学期校历时，应作为访客直接进入只读页', async ({ page }) => {
  await mockAcademicCalendarGraphQL(page);

  await page.goto(routes.labsSemesterCalendar);

  await expect(page).toHaveURL(routes.labsSemesterCalendar);
  await expect(page.getByRole('heading', { name: '学期校历' })).toBeVisible();
  await expect(page.getByText('当前身份：访客身份')).toBeVisible();
  await expect(page.getByText('2025-2026 学年第二学期').first()).toBeVisible();
});
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

test('具备 admin 权限的已登录会话，应允许进入 labs change login email', async ({ page }) => {
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

  await page.goto(routes.labsChangeLoginEmail);

  await expect(page.getByRole('heading', { name: '登录邮箱变更发信页' })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送验证邮件' })).toBeVisible();
});

test('具备 staff 权限的已登录会话，应允许进入 labs upstream session demo', async ({ page }) => {
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

  await expect(page.getByRole('heading', { name: 'Upstream 会话示例页' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '使用说明' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '教师字典' })).toBeVisible();
  await expect(page.getByRole('button', { name: '登录 upstream' })).toHaveCount(0);
});

test('具备 guest 权限的已登录会话，应允许进入 labs 学期校历', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'guest-user',
      primaryAccessGroup: 'GUEST',
    },
  });
  await seedAuthSession(page, {
    displayName: 'guest-user',
    primaryAccessGroup: 'GUEST',
  });
  await mockAcademicCalendarGraphQL(page);

  await page.goto(routes.labsSemesterCalendar);

  await expect(page.getByRole('heading', { name: '学期校历' })).toBeVisible();
  await expect(page.getByText('当前身份：访客身份')).toBeVisible();
  await expect(page.getByText('2025-2026 学年第二学期').first()).toBeVisible();
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
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
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

  await page.getByRole('tab', { name: '教师字典' }).click();
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Upstream 用户名').fill('teacher.alice');
  await page.getByLabel('Upstream 密码').fill('secret-password');
  await page.getByRole('button', { name: '登录并继续' }).click();

  await expect(page.getByText('"value": "teacher-001"')).toBeVisible();
  await expect(page.getByText('预览条数：1')).toBeVisible();

  await page.getByRole('tab', { name: '教职工身份' }).click();
  await expect(page.getByText('姓名：Alice Zhang')).toBeVisible();
  await expect(page.getByText('"identityKind": "STAFF_TEACHER"')).toBeVisible();

  await page.getByRole('tab', { name: '系部教学计划' }).click();
  await page.getByLabel('学年').fill('2026');
  await page.getByLabel('学期').fill('1');
  await page.getByRole('button', { name: /^查\s*询$/ }).click();
  await expect(page.getByText('计划总数：2')).toBeVisible();
  await expect(page.getByText('预览条数：2')).toBeVisible();

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
  await page.getByRole('tab', { name: '教师字典' }).click();
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
      displayName: 'staff-user',
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    accountId: 1001,
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
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

test('labs change login email 可发起 requestChangeLoginEmail 并展示前端验证路由模板', async ({
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

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation RequestChangeLoginEmail')) {
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

  await page.goto(routes.labsChangeLoginEmail);

  await page.getByLabel('新的登录邮箱').fill('new-login@example.com');
  await page.getByRole('button', { name: '给自己发送验证邮件' }).click();

  await expect(page.getByText('验证邮件已请求发送')).toBeVisible();
  await expect(page.locator('text=new-login@example.com').first()).toBeVisible();
  await expect(page.locator('text=/verify/email/\\{verificationCode\\}/').first()).toBeVisible();
});

test('labs change login email 可通过 adminRequestChangeLoginEmail 为指定账号发起验证邮件', async ({
  page,
}) => {
  let requestInput: { accountId?: number; newLoginEmail?: string } | null = null;

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
            input?: { accountId?: number; newLoginEmail?: string };
          };
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation AdminRequestChangeLoginEmail')) {
      requestInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            adminRequestChangeLoginEmail: {
              message: '已为目标账号发送验证邮件',
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

  await page.goto(routes.labsChangeLoginEmail);

  await page.getByLabel('新的登录邮箱').fill('delegated-login@example.com');
  await page.getByLabel('目标账号 ID').fill('9527');
  await page.getByRole('button', { name: '以 admin 身份为指定账号发送' }).click();

  await expect(page.getByText('指定账号的验证邮件已请求发送')).toBeVisible();
  await expect(page.locator('text=9527').first()).toBeVisible();
  await expect(page.locator('text=delegated-login@example.com').first()).toBeVisible();
  expect(requestInput).toEqual({
    accountId: 9527,
    newLoginEmail: 'delegated-login@example.com',
  });
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
  await expect(page.getByRole('banner')).toBeVisible();
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

  await page.getByRole('button', { name: '展开导航菜单' }).click();
  await page.getByText('Labs').click();
  await expect(page.getByText('载荷加解密')).toBeVisible();
  await page.getByText('载荷加解密').click();

  await expect(page).toHaveURL(new RegExp(`${routes.labsPayloadCrypto}$`));
  await expect(page.getByRole('heading', { name: '载荷加解密工具' })).toBeVisible();
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

  await page.getByRole('button', { name: '展开导航菜单' }).click();
  await page.getByText('Labs').click();
  await expect(page.getByText('载荷加解密')).toHaveCount(0);

  await page.goto(routes.labsPayloadCrypto);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('guest 直接访问受限 labs 链接时，应保留 app layout 并显示 dark 模式下的 403', async ({
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

  await page.goto(routes.labsPayloadCrypto);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
  await expect(page.getByRole('button', { name: '切换浅色模式' })).toBeVisible();
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

  await page.goto(`${routes.labsPayloadCrypto}?source=direct`);

  await expect(page).toHaveURL(
    new RegExp(
      `/welcome\\?redirect=${encodeURIComponent(`${routes.labsPayloadCrypto}?source=direct`)}$`,
    ),
  );
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});
