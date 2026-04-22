import type { Locator, Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import {
  mockApiHealth,
  mockAuthGraphQL,
  seedAuthSession,
  type SeedAuthSessionOptions,
} from '../../helpers/app';
import { expect, test } from '../../test';

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';

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

function cloneSemester(record: AcademicSemesterSeed): AcademicSemesterSeed {
  return { ...record };
}

function cloneEvent(record: AcademicCalendarEventSeed): AcademicCalendarEventSeed {
  return { ...record };
}

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
    {
      createdAt: '2026-04-03T00:00:00.000Z',
      endDate: '2026-12-30',
      examStartDate: '2026-12-20',
      firstTeachingDate: '2026-09-07',
      id: 102,
      isCurrent: false,
      name: '2026-2027 学年第一学期',
      schoolYear: 2026,
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
      eventDate: '2026-09-10',
      eventType: 'ACTIVITY',
      id: 202,
      originalDate: null,
      recordStatus: 'ACTIVE',
      ruleNote: null,
      semesterId: 102,
      teachingCalcEffect: 'NO_CHANGE',
      topic: '开学典礼',
      updatedAt: '2026-04-08T00:00:00.000Z',
      updatedByAccountId: 9527,
      version: 1,
    },
  ];

  return { events, semesters };
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
    const input = (variables.input ?? {}) as Record<string, unknown>;

    if (query.includes('query AcademicSemesters')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicSemesters: state.semesters.map(cloneSemester),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation CreateAcademicSemester')) {
      const nextId = Math.max(...state.semesters.map((item) => item.id)) + 1;
      const now = '2026-04-20T00:00:00.000Z';
      const nextRecord: AcademicSemesterSeed = {
        createdAt: now,
        endDate: String(input.endDate ?? ''),
        examStartDate: String(input.examStartDate ?? ''),
        firstTeachingDate: String(input.firstTeachingDate ?? ''),
        id: nextId,
        isCurrent: Boolean(input.isCurrent),
        name: String(input.name ?? ''),
        schoolYear: Number(input.schoolYear ?? 0),
        startDate: String(input.startDate ?? ''),
        termNumber: Number(input.termNumber ?? 1),
        updatedAt: now,
      };

      if (nextRecord.isCurrent) {
        state.semesters = state.semesters.map((item) => ({ ...item, isCurrent: false }));
      }

      state.semesters.push(nextRecord);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            createAcademicSemester: cloneSemester(nextRecord),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation UpdateAcademicSemester')) {
      const now = '2026-04-21T00:00:00.000Z';
      const targetId = Number(input.id ?? 0);
      const currentRecord = state.semesters.find((item) => item.id === targetId);

      if (!currentRecord) {
        await route.fallback();
        return;
      }

      if (input.isCurrent === true) {
        state.semesters = state.semesters.map((item) => ({
          ...item,
          isCurrent: item.id === targetId,
        }));
      }

      const updatedRecord: AcademicSemesterSeed = {
        ...state.semesters.find((item) => item.id === targetId)!,
        endDate: String(input.endDate ?? currentRecord.endDate),
        examStartDate: String(input.examStartDate ?? currentRecord.examStartDate),
        firstTeachingDate: String(input.firstTeachingDate ?? currentRecord.firstTeachingDate),
        isCurrent: typeof input.isCurrent === 'boolean' ? input.isCurrent : currentRecord.isCurrent,
        name: String(input.name ?? currentRecord.name),
        schoolYear:
          typeof input.schoolYear === 'number' ? input.schoolYear : currentRecord.schoolYear,
        startDate: String(input.startDate ?? currentRecord.startDate),
        termNumber:
          typeof input.termNumber === 'number' ? input.termNumber : currentRecord.termNumber,
        updatedAt: now,
      };

      state.semesters = state.semesters.map((item) =>
        item.id === targetId ? updatedRecord : item,
      );

      await route.fulfill({
        body: JSON.stringify({
          data: {
            updateAcademicSemester: cloneSemester(updatedRecord),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation DeleteAcademicSemester')) {
      const targetId = Number(input.id ?? 0);
      state.semesters = state.semesters.filter((item) => item.id !== targetId);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            deleteAcademicSemester: {
              id: targetId,
              success: true,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query AcademicCalendarEvents')) {
      const filteredItems = state.events.filter((item) => {
        if (typeof variables.semesterId === 'number' && item.semesterId !== variables.semesterId) {
          return false;
        }

        if (typeof variables.eventDate === 'string' && item.eventDate !== variables.eventDate) {
          return false;
        }

        if (typeof variables.eventType === 'string' && item.eventType !== variables.eventType) {
          return false;
        }

        if (
          typeof variables.recordStatus === 'string' &&
          item.recordStatus !== variables.recordStatus
        ) {
          return false;
        }

        return true;
      });

      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicCalendarEvents: filteredItems.map(cloneEvent),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation CreateAcademicCalendarEvent')) {
      const nextId = Math.max(...state.events.map((item) => item.id)) + 1;
      const now = '2026-04-22T00:00:00.000Z';
      const nextRecord: AcademicCalendarEventSeed = {
        createdAt: now,
        dayPeriod: (input.dayPeriod as AcademicCalendarEventSeed['dayPeriod']) ?? 'ALL_DAY',
        eventDate: String(input.eventDate ?? ''),
        eventType: (input.eventType as AcademicCalendarEventSeed['eventType']) ?? 'ACTIVITY',
        id: nextId,
        originalDate: typeof input.originalDate === 'string' ? input.originalDate : null,
        recordStatus: (input.recordStatus as AcademicCalendarEventSeed['recordStatus']) ?? 'ACTIVE',
        ruleNote: typeof input.ruleNote === 'string' ? input.ruleNote : null,
        semesterId: Number(input.semesterId ?? 0),
        teachingCalcEffect:
          (input.teachingCalcEffect as AcademicCalendarEventSeed['teachingCalcEffect']) ??
          'NO_CHANGE',
        topic: String(input.topic ?? ''),
        updatedAt: now,
        updatedByAccountId: 9527,
        version: Number(input.version ?? 1),
      };

      state.events.push(nextRecord);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            createAcademicCalendarEvent: cloneEvent(nextRecord),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation UpdateAcademicCalendarEvent')) {
      const targetId = Number(input.id ?? 0);
      const currentRecord = state.events.find((item) => item.id === targetId);

      if (!currentRecord) {
        await route.fallback();
        return;
      }

      const updatedRecord: AcademicCalendarEventSeed = {
        ...currentRecord,
        dayPeriod:
          (input.dayPeriod as AcademicCalendarEventSeed['dayPeriod']) ?? currentRecord.dayPeriod,
        eventDate: typeof input.eventDate === 'string' ? input.eventDate : currentRecord.eventDate,
        eventType:
          (input.eventType as AcademicCalendarEventSeed['eventType']) ?? currentRecord.eventType,
        originalDate:
          typeof input.originalDate === 'string'
            ? input.originalDate
            : input.originalDate === null
              ? null
              : currentRecord.originalDate,
        recordStatus:
          (input.recordStatus as AcademicCalendarEventSeed['recordStatus']) ??
          currentRecord.recordStatus,
        ruleNote:
          typeof input.ruleNote === 'string'
            ? input.ruleNote
            : input.ruleNote === null
              ? null
              : currentRecord.ruleNote,
        semesterId:
          typeof input.semesterId === 'number' ? input.semesterId : currentRecord.semesterId,
        teachingCalcEffect:
          (input.teachingCalcEffect as AcademicCalendarEventSeed['teachingCalcEffect']) ??
          currentRecord.teachingCalcEffect,
        topic: typeof input.topic === 'string' ? input.topic : currentRecord.topic,
        updatedAt: '2026-04-23T00:00:00.000Z',
        version: typeof input.version === 'number' ? input.version : currentRecord.version,
      };

      state.events = state.events.map((item) => (item.id === targetId ? updatedRecord : item));

      await route.fulfill({
        body: JSON.stringify({
          data: {
            updateAcademicCalendarEvent: cloneEvent(updatedRecord),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation DeleteAcademicCalendarEvent')) {
      const targetId = Number(input.id ?? 0);
      state.events = state.events.filter((item) => item.id !== targetId);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            deleteAcademicCalendarEvent: {
              id: targetId,
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

async function fillSemesterForm(
  page: Page,
  values: {
    name: string;
    schoolYear: string;
    startDate: string;
    endDate: string;
    firstTeachingDate: string;
    examStartDate: string;
  },
) {
  const drawer = page.getByRole('dialog').last();

  await drawer.getByLabel('学期名称').fill(values.name);
  await drawer.getByLabel('学年').fill(values.schoolYear);
  await drawer.getByLabel('开始日期', { exact: true }).fill(values.startDate);
  await drawer.getByLabel('结束日期').fill(values.endDate);
  await drawer.getByLabel('教学开始日期').fill(values.firstTeachingDate);
  await drawer.getByLabel('考试周开始日期').fill(values.examStartDate);
}

async function chooseDrawerSelectOption(page: Page, label: string, option: string) {
  const drawer = page.getByRole('dialog').last();
  const field = drawer.locator('.ant-form-item').filter({
    hasText: label,
  });

  await field.locator('.ant-select').click();
  await page.locator('.ant-select-dropdown').last().getByText(option, { exact: true }).click();
}

async function clickDrawerPrimaryButton(page: Page, label: '创建' | '保存') {
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', {
      name: label === '创建' ? /创\s*建/ : /保\s*存/,
    })
    .click();
}

async function clickRowActionButton(row: Locator, action: '编辑' | '删除') {
  await row
    .getByRole('button', {
      name: action === '编辑' ? /编\s*辑/ : /删\s*除/,
    })
    .click();
}

async function confirmDelete(page: Page) {
  await page
    .locator('.ant-popconfirm-buttons')
    .getByRole('button', {
      name: /删\s*除/,
    })
    .click();
}

test('admin 访问正式学期与校历页面时应成功', async ({ page }) => {
  await seedProtectedSession(page, {
    accessGroup: ['ADMIN'],
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });
  await mockAcademicCalendarGraphQL(page);

  await page.goto(routes.academicCalendar);

  await expect(page).toHaveURL(routes.academicCalendar);
  await expect(page.getByRole('heading', { name: '学期与校历事件管理' })).toBeVisible();
  await expect(page.getByText('当前选中学期：2025-2026 学年第二学期')).toBeVisible();
});

test('academic officer 访问正式学期与校历页面时应成功', async ({ page }) => {
  await seedProtectedSession(page, {
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
  await mockAcademicCalendarGraphQL(page);

  await page.goto(routes.academicCalendar);

  await expect(page).toHaveURL(routes.academicCalendar);
  await expect(page.getByRole('heading', { name: '学期与校历事件管理' })).toBeVisible();
  await expect(page.getByText('春季运动会')).toBeVisible();
});

test('普通 staff 访问正式页时应显示 403，旧 labs 地址应返回 404', async ({ page }) => {
  await seedProtectedSession(page, {
    accessGroup: ['STAFF'],
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.academicCalendar);
  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();

  await page.goto('/labs/academic-calendar-admin');
  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
});

test('正式页应支持学期 CRUD', async ({ page }) => {
  test.setTimeout(45000);

  await seedProtectedSession(page, {
    accessGroup: ['ADMIN'],
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });
  await mockAcademicCalendarGraphQL(page);

  await page.goto(routes.academicCalendar);

  await expect(page.getByText('春季运动会')).toBeVisible();
  await expect(page.getByText('当前选中学期：2025-2026 学年第二学期')).toBeVisible();

  await page.getByRole('button', { name: '新增学期' }).click();
  await fillSemesterForm(page, {
    endDate: '2027-01-12',
    examStartDate: '2026-12-20',
    firstTeachingDate: '2026-09-07',
    name: '2026-2027 学年第二学期',
    schoolYear: '2026',
    startDate: '2026-09-01',
  });
  await clickDrawerPrimaryButton(page, '创建');

  const createdSemesterRow = page.locator('tbody tr').filter({
    hasText: '2026-2027 学年第二学期',
  });

  await expect(page.getByText('学期已创建。')).toBeVisible();
  await expect(createdSemesterRow).toHaveCount(1);
  await expect(page.getByText('当前选中学期：2026-2027 学年第二学期')).toBeVisible();

  await clickRowActionButton(createdSemesterRow, '编辑');
  await page.getByLabel('学期名称').fill('2026-2027 学年第二学期（修订）');
  await clickDrawerPrimaryButton(page, '保存');

  const updatedSemesterRow = page.locator('tbody tr').filter({
    hasText: '2026-2027 学年第二学期（修订）',
  });

  await expect(page.getByText('学期已更新。')).toBeVisible();
  await expect(updatedSemesterRow).toHaveCount(1);
  await clickRowActionButton(updatedSemesterRow, '删除');
  await confirmDelete(page);

  await expect(page.getByText('学期已删除。')).toBeVisible();
  await expect(page.getByText('2026-2027 学年第二学期（修订）')).toHaveCount(0);
  await expect(page.getByText('当前选中学期：2025-2026 学年第二学期')).toBeVisible();
});

test('正式页应支持校历事件 CRUD、筛选清空与跨学期切换', async ({ page }) => {
  test.setTimeout(45000);

  await seedProtectedSession(page, {
    accessGroup: ['ADMIN'],
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });
  await mockAcademicCalendarGraphQL(page);

  await page.goto(routes.academicCalendar);

  await expect(page.getByText('春季运动会')).toBeVisible();
  await expect(page.getByText('当前选中学期：2025-2026 学年第二学期')).toBeVisible();

  await page.locator('input[type="date"]').first().fill('2026-04-20');
  await expect(page.getByText('春季运动会')).toBeVisible();
  await expect(page.getByText('当前筛选条件下暂无校历事件')).toHaveCount(0);

  await page.locator('input[type="date"]').first().fill('2026-04-21');
  await expect(page.getByText('当前筛选条件下暂无校历事件')).toBeVisible();

  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(page.getByText('春季运动会')).toBeVisible();

  await page.getByRole('button', { name: '新增事件' }).click();
  await page.getByLabel('事件标题').fill('校历联调事件');
  await page.getByLabel('事件日期').fill('2026-05-06');
  await clickDrawerPrimaryButton(page, '创建');

  await expect(page.getByText('校历事件已创建。')).toBeVisible();
  await expect(page.getByText('校历联调事件')).toBeVisible();

  const createdEventRow = page.locator('tbody tr').filter({
    hasText: '校历联调事件',
  });
  await clickRowActionButton(createdEventRow, '编辑');
  await page.getByLabel('事件标题').fill('校历联调事件（跨学期）');
  await chooseDrawerSelectOption(page, '归属学期', '2026-2027 学年第一学期 · 2026-1');
  await clickDrawerPrimaryButton(page, '保存');

  await expect(page.getByText('校历事件已更新。')).toBeVisible();
  await expect(page.getByText('当前选中学期：2026-2027 学年第一学期')).toBeVisible();
  await expect(page.getByText('校历联调事件（跨学期）')).toBeVisible();

  const movedEventRow = page.locator('tbody tr').filter({
    hasText: '校历联调事件（跨学期）',
  });
  await clickRowActionButton(movedEventRow, '删除');
  await confirmDelete(page);

  await expect(page.getByText('校历事件已删除。')).toBeVisible();
  await expect(page.getByText('校历联调事件（跨学期）')).toHaveCount(0);
});
