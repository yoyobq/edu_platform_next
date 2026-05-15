// e2e/specs/routing/external-teacher-compensation.spec.ts
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

async function fulfillGraphQL(route: Route, data: Record<string, unknown>) {
  await route.fulfill({
    body: JSON.stringify({ data }),
    contentType: 'application/json',
    status: 200,
  });
}

async function mockExternalTeacherCompensationGraphQL(page: Page) {
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: Record<string, unknown> }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query AcademicSemesters')) {
      await fulfillGraphQL(route, {
        academicSemesters: [
          {
            createdAt: '2026-02-01T00:00:00.000Z',
            endDate: '2026-07-05',
            examStartDate: '2026-06-29',
            firstTeachingDate: '2026-02-23',
            id: 202602,
            isCurrent: true,
            name: '2025-2026 学年第二学期',
            schoolYear: 2025,
            startDate: '2026-02-23',
            termNumber: 2,
            updatedAt: '2026-02-01T00:00:00.000Z',
          },
        ],
      });
      return;
    }

    if (query.includes('query AcademicWorkloadDepartmentOptions')) {
      await fulfillGraphQL(route, {
        departments: [
          {
            departmentName: '信息工程系',
            id: 'D-01',
            isEnabled: true,
            shortName: '信息工程系',
          },
        ],
      });
      return;
    }

    if (query.includes('query GetAcademicAdjustedWorkloadReport')) {
      await fulfillGraphQL(route, {
        getAcademicAdjustedWorkloadReport: {
          invalidReason: null,
          isComplete: true,
          isValid: true,
          items: [
            {
              actualHours: '35.5',
              addedHours: '1.5',
              adjustmentHours: '1.5',
              budgetHours: '34',
              coefficient: '1',
              courseCategory: 'REQUIRED',
              courseName: 'Web 前端开发',
              deductedHours: '0',
              semesterId: 202602,
              sstsCourseId: 'COURSE-001',
              sstsTeachingClassId: 'CLASS-001',
              staffId: 'T001',
              staffName: '王老师',
              teacherEngagementType: 'EXTERNAL_TEACHER',
              teachingClassName: '高一 1 班',
              weekCount: 17,
              weeklyHours: '2',
              workloadDepartmentId: 'D-01',
              workloadDepartmentName: '信息工程系',
            },
          ],
          total: {
            actualHours: '35.5',
            addedHours: '1.5',
            adjustmentHours: '1.5',
            budgetHours: '34',
            deductedHours: '0',
            itemCount: 1,
            staffCount: 1,
          },
          truncationReason: null,
        },
      });
      return;
    }

    await route.fallback();
  });
}

test('外聘兼课金 stable 页面可生成报表并导出 Excel', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: adminSession });
  await mockExternalTeacherCompensationGraphQL(page);
  await seedAuthSession(page, adminSession);

  await page.goto(routes.externalTeacherCompensation);

  await expect(page).toHaveURL(routes.externalTeacherCompensation);
  await expect(page.getByRole('heading', { name: '兼职教师兼课金结算表' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '王老师' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Web 前端开发' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出 Excel/ }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain('兼职教师兼课金结算表');
});
