import { type Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import {
  AUTH_STORAGE_KEY,
  ensureFullNavigation,
  mockApiHealth,
  mockAuthGraphQL,
  seedAuthSession,
  type SeedAuthSessionOptions,
} from '../../helpers/app';
import { expect, test } from '../../test';

type AcademicSemesterSeed = {
  createdAt: string;
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  id: number;
  isCurrent: boolean;
  isVisible: boolean;
  name: string;
  schoolYear: number;
  sortOrder: number;
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

type AcademicCalendarGraphQLRequestCounters = {
  academicCalendarEvents: number;
  academicSemesters: number;
  studentAcademicCalendarEvents: number;
  studentAcademicSemesters: number;
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
      isVisible: true,
      name: '2025-2026 学年第二学期',
      schoolYear: 2025,
      sortOrder: 10,
      startDate: '2026-02-17',
      termNumber: 2,
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
    {
      createdAt: '2026-04-03T00:00:00.000Z',
      endDate: '2026-12-30',
      examStartDate: '2026-12-20',
      firstTeachingDate: '2026-09-07',
      id: 102,
      isCurrent: false,
      isVisible: true,
      name: '2026-2027 学年第一学期',
      schoolYear: 2026,
      sortOrder: 20,
      startDate: '2026-09-01',
      termNumber: 1,
      updatedAt: '2026-04-04T00:00:00.000Z',
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
    {
      createdAt: '2026-04-07T00:00:00.000Z',
      dayPeriod: 'MORNING',
      eventDate: '2026-04-25',
      eventType: 'HOLIDAY',
      id: 202,
      originalDate: null,
      recordStatus: 'TENTATIVE',
      ruleNote: '节假日安排待最终确认',
      semesterId: 101,
      teachingCalcEffect: 'CANCEL',
      topic: '劳动节调休预告',
      updatedAt: '2026-04-08T00:00:00.000Z',
      updatedByAccountId: 9527,
      version: 2,
    },
    {
      createdAt: '2026-04-09T00:00:00.000Z',
      dayPeriod: 'MORNING',
      eventDate: '2026-09-10',
      eventType: 'ACTIVITY',
      id: 203,
      originalDate: null,
      recordStatus: 'ACTIVE',
      ruleNote: null,
      semesterId: 102,
      teachingCalcEffect: 'NO_CHANGE',
      topic: '开学典礼',
      updatedAt: '2026-04-10T00:00:00.000Z',
      updatedByAccountId: 9527,
      version: 1,
    },
    {
      createdAt: '2026-04-11T00:00:00.000Z',
      dayPeriod: 'ALL_DAY',
      eventDate: '2026-09-02',
      eventType: 'ACTIVITY',
      id: 204,
      originalDate: null,
      recordStatus: 'ACTIVE',
      ruleNote: null,
      semesterId: 102,
      teachingCalcEffect: 'NO_CHANGE',
      topic: '迎新报到',
      updatedAt: '2026-04-12T00:00:00.000Z',
      updatedByAccountId: 9527,
      version: 1,
    },
  ];

  return { events, semesters };
}

function toStudentAcademicSemesters(semesters: readonly AcademicSemesterSeed[]) {
  return semesters.map((semester) => ({
    endDate: semester.endDate,
    examStartDate: semester.examStartDate,
    firstTeachingDate: semester.firstTeachingDate,
    id: semester.id,
    isCurrent: semester.isCurrent,
    name: semester.name,
    schoolYear: semester.schoolYear,
    startDate: semester.startDate,
    termNumber: semester.termNumber,
  }));
}

function toStudentAcademicCalendarEvents(events: readonly AcademicCalendarEventSeed[]) {
  return events.map((event) => ({
    dayPeriod: event.dayPeriod,
    eventDate: event.eventDate,
    eventType: event.eventType,
    id: event.id,
    originalDate: event.originalDate,
    ruleNote: event.ruleNote,
    semesterId: event.semesterId,
    teachingCalcEffect: event.teachingCalcEffect,
    topic: event.topic,
  }));
}

async function mockAcademicCalendarGraphQL(page: Page) {
  const state = buildAcademicCalendarState();
  const requestCounters: AcademicCalendarGraphQLRequestCounters = {
    academicCalendarEvents: 0,
    academicSemesters: 0,
    studentAcademicCalendarEvents: 0,
    studentAcademicSemesters: 0,
  };

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: Record<string, unknown>;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';
    const variables = payload?.variables ?? {};

    if (query.includes('query StudentAcademicSemesters')) {
      requestCounters.studentAcademicSemesters += 1;
      const semesters = variables.isCurrent
        ? state.semesters.filter((semester) => semester.isCurrent)
        : state.semesters;
      const limit = typeof variables.limit === 'number' ? variables.limit : semesters.length;

      await route.fulfill({
        body: JSON.stringify({
          data: {
            studentAcademicSemesters: toStudentAcademicSemesters(semesters.slice(0, limit)),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query StudentAcademicCalendarEvents')) {
      requestCounters.studentAcademicCalendarEvents += 1;
      const semesterId = Number(variables.semesterId ?? 0);
      const limit = typeof variables.limit === 'number' ? variables.limit : state.events.length;

      await route.fulfill({
        body: JSON.stringify({
          data: {
            studentAcademicCalendarEvents: toStudentAcademicCalendarEvents(
              state.events
                .filter((item) => item.semesterId === semesterId && item.recordStatus === 'ACTIVE')
                .slice(0, limit),
            ),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query AcademicSemesters')) {
      requestCounters.academicSemesters += 1;
      const semesters =
        typeof variables.isVisible === 'boolean'
          ? state.semesters.filter((semester) => semester.isVisible === variables.isVisible)
          : state.semesters;

      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicSemesters: semesters,
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query AcademicCalendarEvents')) {
      requestCounters.academicCalendarEvents += 1;
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

  return requestCounters;
}

async function seedProtectedSession(page: Page, currentSession: SeedAuthSessionOptions) {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession });
  await seedAuthSession(page, currentSession);
}

function buildAccessTokenWithClaims(claims: {
  accessGroup: readonly string[];
  slotGroup: readonly string[];
}) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');

  return `${header}.${payload}.signature`;
}

async function overrideStoredAccessToken(page: Page, accessToken: string) {
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

async function seedSemesterCalendarPage(page: Page, currentSession: SeedAuthSessionOptions) {
  await seedProtectedSession(page, currentSession);
  return mockAcademicCalendarGraphQL(page);
}

test('admin 访问正式学期校历页时应成功并支持查看事件详情', async ({ page }) => {
  await seedSemesterCalendarPage(page, {
    accessGroup: ['ADMIN'],
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.semesterCalendar);

  await expect(page).toHaveURL(routes.semesterCalendar);
  await expect(page.getByRole('heading', { name: '学期校历' })).toBeVisible();
  await expect(
    page.locator('.ant-card-head-title').filter({ hasText: '2025-2026 学年第二学期' }),
  ).toBeVisible();
  await expect(page.getByText('教学周 18 周')).toBeVisible();
  await expect(page.getByText('月份')).toBeVisible();
  await expect(page.getByText('2月').first()).toBeVisible();
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('学期开始')).toBeVisible();
  await expect(page.getByText('教学开始：2026-02-20')).toBeVisible();
  await expect(page.getByText('考试周', { exact: true })).toBeVisible();
  await expect(page.getByText('春季运动会')).toBeVisible();
  await expect(page.getByText('劳动节调休预告')).toBeVisible();

  await page.getByText('春季运动会').click();

  await expect(page.getByText('规则说明')).toBeVisible();
  await expect(page.getByText('春季活动安排')).toBeVisible();
  await expect(page.getByText('版本号')).toBeVisible();
  await expect(page.getByRole('button', { name: '去正式页维护' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '进入正式管理页' })).toHaveCount(0);
});

test('academic officer 访问正式学期校历页时应成功', async ({ page }) => {
  await seedSemesterCalendarPage(page, {
    accessGroup: ['STAFF'],
    displayName: 'academic-officer',
    primaryAccessGroup: 'STAFF',
    slotGroup: ['ACADEMIC_OFFICER'],
  });
  await overrideStoredAccessToken(
    page,
    buildAccessTokenWithClaims({
      accessGroup: ['STAFF'],
      slotGroup: ['ACADEMIC_OFFICER'],
    }),
  );

  await page.goto(routes.semesterCalendar);

  await expect(page).toHaveURL(routes.semesterCalendar);
  await expect(page.getByRole('heading', { name: '学期校历' })).toBeVisible();
  await expect(page.getByText('春季运动会')).toBeVisible();
});

test('student 访问正式学期校历页时应成功，并使用独立学生导航', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const requestCounters = await seedSemesterCalendarPage(page, {
    accountId: 2001,
    accessGroup: ['STUDENT'],
    displayName: 'student-user',
    identity: {
      currentClassCode: '1031301',
      currentClassId: 'class-1031301',
      id: 'S001',
      kind: 'STUDENT',
      upstreamId: '313010201',
    },
    identityName: '测试学生',
    primaryAccessGroup: 'STUDENT',
  });

  await page.goto(routes.semesterCalendar);

  await expect(page).toHaveURL(routes.semesterCalendar);
  await expect(page.getByRole('heading', { name: '学期校历' })).toBeVisible();
  await expect(page.getByText('春季运动会')).toBeVisible();
  await expect(page.getByText('劳动节调休预告')).toHaveCount(0);

  await page.getByText('春季运动会').click();
  await expect(page.getByText('规则说明')).toBeVisible();
  await expect(page.getByText('版本号')).toHaveCount(0);
  await expect(page.getByText('更新时间')).toHaveCount(0);
  await expect(page.getByText('生效', { exact: true })).toHaveCount(0);
  await expect(page.getByText('暂定', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByText('规则说明')).toHaveCount(0);

  await ensureFullNavigation(page);
  await expect(page.getByRole('menuitem', { name: '学期校历' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '校历课表' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '教务助手' })).toHaveCount(0);

  await page.getByRole('button', { name: '用户菜单' }).click();
  await expect(page.getByText('student-user@example.com')).toBeVisible();
  await expect(page.getByText('个人资料')).toBeVisible();
  await expect(page.getByText('退出登录')).toBeVisible();
  await expect(page.getByText('增加另一个账号')).toHaveCount(0);
  expect(requestCounters).toEqual({
    academicCalendarEvents: 0,
    academicSemesters: 0,
    studentAcademicCalendarEvents: 1,
    studentAcademicSemesters: 1,
  });
});

test('正式学期校历页应支持切换学期并刷新周视图内容', async ({ page }) => {
  await seedSemesterCalendarPage(page, {
    accessGroup: ['ADMIN'],
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.semesterCalendar);

  await expect(page.getByText('春季运动会')).toBeVisible();

  await page.getByLabel('选择学期').click();
  await page
    .locator('.ant-select-dropdown')
    .last()
    .getByText('2026-2027 学年第一学期', { exact: true })
    .click();

  await expect(
    page
      .locator('.semester-calendar-card-toolbar-control')
      .getByText('2026-2027 学年第一学期', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText('9月').first()).toBeVisible();
  await expect(page.getByText('教学开始：2026-09-07')).toBeVisible();
  await expect(page.getByText('迎新报到')).toBeVisible();
  await expect(page.getByText('开学典礼')).toBeVisible();
  await expect(page.getByText('春季运动会')).toHaveCount(0);
});

test('普通 staff 可访问正式学期校历页，guest 访问时应显示 403', async ({ page }) => {
  await seedSemesterCalendarPage(page, {
    accessGroup: ['STAFF'],
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.semesterCalendar);
  await expect(page.getByRole('heading', { name: '学期校历' })).toBeVisible();

  await seedProtectedSession(page, {
    accessGroup: ['GUEST'],
    displayName: 'guest-user',
    primaryAccessGroup: 'GUEST',
  });

  await page.goto(routes.semesterCalendar);
  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});
