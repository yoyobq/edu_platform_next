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
    items: [buildOccurrence(staffId, staffName)],
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
  await expect(page.getByText('9月8日 · 周二', { exact: true })).toBeVisible();
  await expect(page.getByText('知行楼 302', { exact: true })).toBeVisible();
  await expect(page.getByText('教师', { exact: true })).toHaveCount(0);
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
