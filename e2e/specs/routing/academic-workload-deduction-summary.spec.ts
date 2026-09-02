// e2e/specs/routing/academic-workload-deduction-summary.spec.ts

import type { Page, Route } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const adminSession = {
  accessGroup: ['ADMIN'] as const,
  displayName: 'academic-admin',
  identity: null,
  identityHint: 'ADMIN' as const,
  primaryAccessGroup: 'ADMIN' as const,
};

const semester = {
  createdAt: '2026-02-01T00:00:00.000Z',
  endDate: '2026-07-05',
  examStartDate: '2026-06-29',
  firstTeachingDate: '2026-02-23',
  id: 202602,
  isCurrent: true,
  isVisible: true,
  name: '2025-2026 学年第二学期',
  schoolYear: 2025,
  sortOrder: 0,
  startDate: '2026-02-23',
  termNumber: 2,
  updatedAt: '2026-02-01T00:00:00.000Z',
};

const zeroDeductionItem = {
  addedHours: '0',
  adjustmentDates: [],
  baselineHours: '32',
  baselineTeachingWeekCount: 16,
  baselineWeeklyHours: '2',
  courseCategory: 'THEORY',
  courseName: '语文',
  deductedHours: '0',
  deductionReasonSummaries: [],
  staffId: 'T-001',
  staffName: '王老师',
  teacherEngagementType: 'FULL_TIME_TEACHER',
  teachingClassName: '高一 1 班',
  workloadDepartmentId: 'ORG0302',
  workloadDepartmentName: '信息工程系',
};

async function fulfillGraphQL(route: Route, data: Record<string, unknown>) {
  await route.fulfill({
    body: JSON.stringify({ data }),
    contentType: 'application/json',
    status: 200,
  });
}

async function mockDeductionSummaryGraphQL(page: Page, items: Array<typeof zeroDeductionItem>) {
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query AcademicSemesters')) {
      await fulfillGraphQL(route, { academicSemesters: [semester] });
      return;
    }

    if (query.includes('query AcademicWorkloadDepartmentOptions')) {
      await fulfillGraphQL(route, {
        departments: [
          {
            departmentName: '信息工程系',
            id: 'ORG0302',
            isEnabled: true,
            shortName: '信息工程系',
          },
        ],
      });
      return;
    }

    if (query.includes('query AcademicWorkloadDeductionSummary')) {
      await fulfillGraphQL(route, {
        academicCalendarEvents: [
          {
            eventDate: '2026-04-06',
            eventType: 'HOLIDAY',
            originalDate: null,
            teachingCalcEffect: 'CANCEL',
          },
          {
            eventDate: '2026-05-09',
            eventType: 'WEEKDAY_SWAP',
            originalDate: '2026-05-04',
            teachingCalcEffect: 'SWAP',
          },
          {
            eventDate: '2026-04-20',
            eventType: 'SPORTS_MEET',
            originalDate: null,
            teachingCalcEffect: 'CANCEL',
          },
          {
            eventDate: '2026-04-25',
            eventType: 'HOLIDAY_MAKEUP',
            originalDate: '2026-04-06',
            teachingCalcEffect: 'MAKEUP',
          },
          {
            eventDate: '2026-04-30',
            eventType: 'ACTIVITY',
            originalDate: null,
            teachingCalcEffect: 'NO_CHANGE',
          },
          {
            eventDate: '2026-04-26',
            eventType: 'REPEATED_TEACHING_DAY',
            originalDate: '2026-04-27',
            teachingCalcEffect: 'REPEAT',
          },
        ],
        getAcademicWorkloadDeductionSummary: {
          departmentSummaries: [],
          invalidReason: null,
          isComplete: true,
          isValid: true,
          items,
          total: {
            addedHours: '0',
            baselineHours: items.length > 0 ? '32' : '0',
            deductedHours: '0',
            itemCount: items.length,
            staffCount: items.length > 0 ? 1 : 0,
          },
          truncationReason: null,
        },
      });
      return;
    }

    await route.fallback();
  });
}

async function openDeductionSummary(page: Page, items: Array<typeof zeroDeductionItem>) {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: adminSession });
  await mockDeductionSummaryGraphQL(page, items);
  await seedAuthSession(page, adminSession);
  await page.goto(routes.academicWorkloadDeductionSummary);

  await expect(page.getByRole('heading', { name: '教师节假日扣课时统计表' })).toBeVisible();
}

test('零扣课课程仍显示全部潜在扣课日期并同步导出 Excel', async ({ page }) => {
  await openDeductionSummary(page, [zeroDeductionItem]);

  await expect(page.getByRole('columnheader', { name: /4月6日/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /5月4日/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /4月20日/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /5月9日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月25日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月26日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月30日/ })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: '语文' })).toContainText('0');

  await page.getByRole('switch', { name: '计入运动会扣课' }).click();
  await expect(page.getByRole('columnheader', { name: /4月20日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月6日/ })).toBeVisible();

  await page.getByRole('switch', { name: '计入运动会扣课' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Excel' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(downloadPath).not.toBeNull();

  const { default: XLSX } = await import('xlsx');
  const workbook = XLSX.readFile(downloadPath!);
  const worksheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet!, { header: 1 });
  const headers = rows[3] ?? [];

  expect(headers).toEqual(
    expect.arrayContaining([
      expect.stringContaining('4月6日'),
      expect.stringContaining('4月20日'),
      expect.stringContaining('5月4日'),
    ]),
  );
});

test('无课程行时仍显示完整特殊日期表头', async ({ page }) => {
  await openDeductionSummary(page, []);

  await expect(page.getByRole('columnheader', { name: /4月6日/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /5月4日/ })).toBeVisible();
  await expect(page.getByText('当前条件下没有课程记录。')).toBeVisible();
  await expect(page.getByText('专任教师小计')).toBeVisible();
});
