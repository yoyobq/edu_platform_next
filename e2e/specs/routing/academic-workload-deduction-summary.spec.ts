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
  baselineHours: '32',
  baselineTeachingWeekCount: 16,
  baselineWeeklyHours: '2',
  courseCategory: 'THEORY',
  courseName: '语文',
  dateAdjustments: [] as Array<{
    date: string;
    deductionSourceEventTypes: Array<string | null>;
    netAdjustmentHours: string;
    repeatedHours: string;
    residualDeductedHours: string;
  }>,
  netAdjustmentHours: '0',
  repeatedHours: '0',
  residualDeductedHours: '0',
  staffId: 'T-001',
  staffName: '王老师',
  teacherEngagementType: 'FULL_TIME_TEACHER',
  teachingClassName: '高一 1 班',
  workloadDepartmentId: 'ORG0302',
  workloadDepartmentName: '信息工程系',
};

const repeatedTeachingItem = {
  ...zeroDeductionItem,
  dateAdjustments: [
    {
      date: '2026-04-06',
      deductionSourceEventTypes: ['HOLIDAY'],
      netAdjustmentHours: '-2',
      repeatedHours: '0',
      residualDeductedHours: '2',
    },
    {
      date: '2026-04-26',
      deductionSourceEventTypes: [],
      netAdjustmentHours: '3',
      repeatedHours: '3',
      residualDeductedHours: '0',
    },
  ],
  netAdjustmentHours: '1',
  repeatedHours: '3',
  residualDeductedHours: '2',
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
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { includeSportsMeetDeductions?: boolean } }
      | undefined;
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
      const includeSportsMeetDeductions = payload?.variables?.includeSportsMeetDeductions !== false;
      const hasResidualHoliday = items.some((item) =>
        item.dateAdjustments.some(
          (adjustment) =>
            adjustment.date === '2026-04-06' && Number(adjustment.residualDeductedHours) > 0,
        ),
      );
      const dateColumns = [
        ...(hasResidualHoliday ? [{ date: '2026-04-06', isRepeatedTeachingDate: false }] : []),
        ...(includeSportsMeetDeductions
          ? [{ date: '2026-04-20', isRepeatedTeachingDate: false }]
          : []),
        { date: '2026-04-26', isRepeatedTeachingDate: true },
      ];
      const firstItem = items[0];
      const residualDeductedHours = firstItem?.residualDeductedHours ?? '0';
      const repeatedHours = firstItem?.repeatedHours ?? '0';
      const netAdjustmentHours = firstItem?.netAdjustmentHours ?? '0';
      await fulfillGraphQL(route, {
        getAcademicWorkloadDeductionSummary: {
          dateColumns,
          departmentSummaries: [],
          invalidReason: null,
          isComplete: true,
          isValid: true,
          items,
          staffSummaries:
            firstItem === undefined
              ? []
              : [
                  {
                    itemCount: items.length,
                    netAdjustmentHours,
                    repeatedHours,
                    residualDeductedHours,
                    staffId: firstItem.staffId,
                    workloadDepartmentId: firstItem.workloadDepartmentId,
                  },
                ],
          total: {
            addedHours: '0',
            baselineHours: items.length > 0 ? '32' : '0',
            deductedHours: '0',
            itemCount: items.length,
            netAdjustmentHours,
            repeatedHours,
            residualDeductedHours,
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

test('零扣课课程保留未抵消特殊日期与重复教学日并同步导出 Excel', async ({ page }) => {
  await openDeductionSummary(page, [zeroDeductionItem]);

  await expect(page.getByRole('columnheader', { name: /4月6日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /5月4日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月20日/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /5月9日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月25日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月26日/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /4月30日/ })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: '语文' })).toContainText('0');

  await page.getByRole('switch', { name: '计入运动会扣课' }).click();
  await expect(page.getByRole('columnheader', { name: /4月20日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月26日/ })).toBeVisible();

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
      expect.stringContaining('4月20日'),
      expect.stringContaining('4月26日'),
    ]),
  );
  expect(headers.some((value) => String(value).includes('4月6日'))).toBe(false);
  expect(headers.some((value) => String(value).includes('5月4日'))).toBe(false);
});

test('重复教学显示绿色正数并按净额汇总，补课日期不单独上表', async ({ page }) => {
  await openDeductionSummary(page, [repeatedTeachingItem]);

  const repeatHeader = page.getByRole('columnheader', { name: /4月26日/ });
  const detailRow = page.getByRole('row').filter({ hasText: '语文' });

  await expect(repeatHeader).toBeVisible();
  await expect(
    repeatHeader.locator('.academic-workload-deduction-summary-repeat-date-column-title'),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /4月25日/ })).toHaveCount(0);
  await expect(detailRow.locator('td').nth(7)).toHaveText('-2');
  await expect(detailRow.locator('td').nth(9)).toHaveText('3');
  await expect(
    detailRow
      .locator('td')
      .nth(9)
      .locator('.academic-workload-deduction-summary-adjustment-positive'),
  ).toBeVisible();
  await expect(detailRow.locator('td').nth(10)).toHaveText('1');
  await expect(detailRow.locator('td').nth(11)).toHaveText('1');
  await expect(detailRow).not.toContainText('+3');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Excel' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(downloadPath).not.toBeNull();

  const { default: XLSX } = await import('xlsx');
  const workbook = XLSX.readFile(downloadPath!);
  const worksheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  const rows = XLSX.utils.sheet_to_json<Array<number | string>>(worksheet!, { header: 1 });
  const headers = rows[3] ?? [];
  const detailValues = rows[4] ?? [];
  const repeatColumnIndex = headers.findIndex((value) => String(value).includes('4月26日'));
  const makeupColumnIndex = headers.findIndex((value) => String(value).includes('4月25日'));
  const subtotalColumnIndex = headers.findIndex((value) => value === '小计');
  const totalColumnIndex = headers.findIndex((value) => value === '合计');

  expect(repeatColumnIndex).toBeGreaterThan(-1);
  expect(makeupColumnIndex).toBe(-1);
  expect(detailValues[repeatColumnIndex]).toBe(3);
  expect(detailValues[subtotalColumnIndex]).toBe(1);
  expect(detailValues[totalColumnIndex]).toBe(1);
});

test('无课程行时仍显示完整特殊日期表头', async ({ page }) => {
  await openDeductionSummary(page, []);

  await expect(page.getByRole('columnheader', { name: /4月6日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /5月4日/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /4月26日/ })).toBeVisible();
  await expect(page.getByText('当前条件下没有课程记录。')).toBeVisible();
  await expect(page.getByText('专任教师小计')).toBeVisible();

  await page.getByRole('tab', { name: '全部教师' }).click();
  await expect(page.getByRole('button', { name: '导出 Excel' })).toBeVisible();
});
