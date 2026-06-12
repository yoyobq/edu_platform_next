// e2e/specs/routing/my-curriculum-plan-homepage.spec.ts

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

test('具备 staff 权限的已登录会话，应允许进入 My 计划首页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'staff-user',
      identity: {
        id: 'staff-1001',
        kind: 'STAFF',
      },
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    displayName: 'staff-user',
    identity: {
      id: 'staff-1001',
      kind: 'STAFF',
    },
    primaryAccessGroup: 'STAFF',
  });

  let academicSemestersQueryCount = 0;
  let departmentQueryCount = 0;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query AcademicSemesters')) {
      academicSemestersQueryCount += 1;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicSemesters: [],
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query CurriculumPlanHomepageDepartments')) {
      departmentQueryCount += 1;
      await route.fulfill({
        body: JSON.stringify({
          errors: [{ message: '缺少所需角色' }],
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.myCurriculumPlanHomepage);

  await expect(page.getByRole('heading', { name: 'My 计划首页' })).toBeVisible();
  await expect(page.getByRole('button', { name: '读取计划列表' })).toBeVisible();
  await expect(page.getByText('系部')).toHaveCount(0);
  await expect.poll(() => academicSemestersQueryCount).toBeGreaterThan(0);
  expect(departmentQueryCount).toBe(0);
  await expect(page.getByText('缺少所需角色')).toHaveCount(0);
});
