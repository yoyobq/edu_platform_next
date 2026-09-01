import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const CURRENT_SEMESTER = {
  createdAt: '2026-08-01T00:00:00.000Z',
  endDate: '2027-01-20',
  examStartDate: '2027-01-10',
  firstTeachingDate: '2026-09-01',
  id: 7,
  isCurrent: true,
  isVisible: true,
  name: '2026-2027 学年第一学期',
  schoolYear: 2026,
  sortOrder: 1,
  startDate: '2026-08-31',
  termNumber: 1,
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function buildOccurrence(staffId: string, staffName: string) {
  return {
    calcEffect: 'NORMAL',
    classroomName: '知行楼 302',
    coefficient: '1.0',
    courseCategory: 'THEORY',
    courseName: '数据库原理',
    date: '2026-09-08',
    isEffective: true,
    logicalDayOfWeek: 2,
    periodEnd: 2,
    periodStart: 1,
    physicalDayOfWeek: 2,
    scheduleId: 901,
    semesterId: 7,
    slotId: 9001,
    staffId,
    staffName,
    teachingClassName: '软件 2401',
    weekIndex: 2,
  };
}

function buildEnvelope(staffId: string, staffName: string) {
  return {
    invalidReason: null,
    isComplete: true,
    isValid: true,
    items: [
      buildOccurrence(staffId, staffName),
      {
        ...buildOccurrence(staffId, staffName),
        periodEnd: 4,
        periodStart: 3,
        slotId: 9002,
      },
      {
        ...buildOccurrence(staffId, staffName),
        courseCategory: 'INTEGRATED',
        courseName: '操作系统',
        date: '2026-09-09',
        physicalDayOfWeek: 3,
        scheduleId: 902,
        slotId: 9003,
        teachingClassName: '软件 2402',
      },
    ],
    truncationReason: null,
  };
}

async function seedStaff(
  page: Page,
  input: { slotGroup?: readonly string[]; staffId?: string } = {},
) {
  const session = {
    displayName: '王老师',
    identity: { id: input.staffId ?? 'staff-1001', kind: 'STAFF' as const },
    primaryAccessGroup: 'STAFF' as const,
    slotGroup: input.slotGroup ?? [],
  };

  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: session });
  await seedAuthSession(page, session);
}

test('普通教师默认按当前学期查看本人的课程日期真源投影', async ({ page }) => {
  await seedStaff(page);
  let requestedSemesterId: number | null = null;
  let managedQueryCount = 0;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { semesterId?: number } }
      | undefined;
    const query = payload?.query ?? '';

    if (query.includes('query MyTeachingPlanAcademicSemesters')) {
      await route.fulfill({
        body: JSON.stringify({ data: { academicSemesters: [CURRENT_SEMESTER] } }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('query MyTeachingPlan(')) {
      requestedSemesterId = payload?.variables?.semesterId ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: { listMyAcademicSemesterPlannedTimetable: buildEnvelope('staff-1001', '王老师') },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('query ManagedTeachingPlan(')) {
      managedQueryCount += 1;
    }

    await route.fallback();
  });

  await page.goto(routes.labsMyTeachingPlan);

  await expect(page.getByRole('heading', { name: 'My 教学计划' })).toBeVisible();
  await expect(page.getByText('数据库原理', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('table', { name: '数据库原理课程教学计划' })).toBeVisible();
  await expect(page.getByText('1,2', { exact: true })).toBeVisible();
  await expect(page.getByText('3,4', { exact: true })).toBeVisible();
  await expect(page.getByText('2026-09-08', { exact: true })).toHaveCount(2);
  await expect(page.getByText('线下', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('columnheader', { name: '授课章节与内容' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '课外作业' })).toBeVisible();
  await expect(page.getByText('待填写', { exact: true })).toHaveCount(4);
  await expect(page.getByText('输入姓名或工号选择教师', { exact: true })).toHaveCount(0);
  await expect(page.getByText('这是限时本地草稿，请及时导出')).toBeVisible();
  await expect(page.getByText(/最后一次编辑 24 小时后自动清除，服务器不会保存/)).toBeVisible();

  const previousCourseButton = page.getByRole('button', { name: '上一门课程' });
  const nextCourseButton = page.getByRole('button', { name: '下一门课程' });
  await expect(previousCourseButton).toBeDisabled();
  await nextCourseButton.click();
  await expect(page.getByText('一体化课程使用另一种教学计划表')).toBeVisible();
  await expect(page.getByRole('table', { name: '操作系统课程教学计划' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导出 Excel' })).toHaveCount(0);
  await expect(nextCourseButton).toBeDisabled();
  await previousCourseButton.click();
  await expect(page.getByRole('table', { name: '数据库原理课程教学计划' })).toBeVisible();

  const firstLocation = page.getByLabel('2026-09-08第1,2节授课地点');
  const secondLocation = page.getByLabel('2026-09-08第3,4节授课地点');
  await firstLocation.fill('机房 5102');
  await firstLocation.press('Tab');
  await expect(secondLocation).toHaveValue('机房 5102');
  await expect(page.getByText(/已将“机房 5102”填入本课程其余 1 个空白课次/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Excel' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('软件 2401-数据库原理-教学计划.xlsx');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(downloadPath!);
  const worksheet = workbook.getWorksheet('教学计划');

  expect(worksheet?.getRow(1).values).toEqual([
    undefined,
    '授课时间',
    '学时数',
    '节次',
    '授课方式',
    '授课地点',
    '授课章节与内容',
    '课外作业',
  ]);
  expect(worksheet?.getRow(2).values).toEqual([
    undefined,
    '2026-09-08',
    2,
    '1,2',
    '线下',
    '机房 5102',
    '',
    '',
  ]);
  expect(worksheet?.getRow(3).values).toEqual([
    undefined,
    '2026-09-08',
    2,
    '3,4',
    '线下',
    '机房 5102',
    '',
    '',
  ]);

  await expect.poll(() => requestedSemesterId).toBe(7);
  expect(managedQueryCount).toBe(0);
});

test('教务管理人员可切换受管教师并读取受管真源查询', async ({ page }) => {
  await seedStaff(page, { slotGroup: ['ACADEMIC_OFFICER'] });
  let requestedStaffId: string | null = null;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { staffId?: string } }
      | undefined;
    const query = payload?.query ?? '';

    if (query.includes('query MyTeachingPlanAcademicSemesters')) {
      await route.fulfill({
        body: JSON.stringify({ data: { academicSemesters: [CURRENT_SEMESTER] } }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('query ManagedTeachingPlanTeacherOptions')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            listManagedAcademicSemesterPlannedTimetableTeacherOptions: {
              items: [
                { staffId: 'staff-1001', staffName: '王老师' },
                { staffId: 'staff-2002', staffName: '李老师' },
              ],
            },
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('query ManagedTeachingPlan(')) {
      const staffId = payload?.variables?.staffId ?? 'staff-1001';
      requestedStaffId = staffId;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            listManagedAcademicSemesterPlannedTimetable: buildEnvelope(
              staffId,
              staffId === 'staff-2002' ? '李老师' : '王老师',
            ),
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsMyTeachingPlan);

  await expect(page.getByText('教师', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(2);
  await page.getByRole('combobox').nth(1).click();
  await page.getByText('李老师', { exact: true }).click();

  await expect.poll(() => requestedStaffId).toBe('staff-2002');
  await expect(
    page.locator('.ant-card-extra .ant-tag').filter({ hasText: '李老师' }),
  ).toBeVisible();
});
