import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, openHomeAs, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const WORKBENCH_TODOS_STORAGE_KEY = 'edu-mate:home-workbench-other-todos:v1:1001';
const WORKBENCH_TIMETABLE_STORAGE_KEY =
  'edu-mate:timetable-custom-items:v1:/:weekly:101:2026-05-04';
const fixedWorkbenchDate = new Date('2026-05-05T12:00:00.000Z');

async function mockHomeWorkbenchTimetableGraphQL(page: Page) {
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: Record<string, unknown>;
        }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query AcademicSemesters')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicSemesters: [
              {
                createdAt: '2026-04-01T00:00:00.000Z',
                endDate: '2026-07-31',
                examStartDate: '2026-07-13',
                firstTeachingDate: '2026-05-04',
                id: 101,
                isCurrent: true,
                name: '2026 春季学期',
                schoolYear: 2026,
                startDate: '2026-05-01',
                termNumber: 2,
                updatedAt: '2026-04-01T00:00:00.000Z',
              },
            ],
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query ListAcademicWeeklyPlannedTimetable')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            listAcademicWeeklyPlannedTimetable: {
              invalidReason: null,
              isComplete: true,
              isValid: true,
              items: [
                {
                  calcEffect: 'NORMAL',
                  classroomName: 'A101',
                  coefficient: '1',
                  courseCategory: 'THEORY',
                  courseName: '测试课程',
                  date: '2026-05-04',
                  isEffective: true,
                  logicalDayOfWeek: 1,
                  periodEnd: 1,
                  periodStart: 1,
                  physicalDayOfWeek: 1,
                  scheduleId: 9001,
                  semesterId: 101,
                  slotId: 9101,
                  staffId: 'staff-1001',
                  staffName: '测试老师',
                  teachingClassName: '测试班级',
                  weekIndex: 1,
                },
              ],
              truncationReason: null,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query ListMyAcademicSemesterPlannedTimetable')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            listMyAcademicSemesterPlannedTimetable: {
              invalidReason: null,
              isComplete: true,
              isValid: true,
              items: [
                {
                  calcEffect: 'NORMAL',
                  classroomName: 'A101',
                  coefficient: '1',
                  courseCategory: 'THEORY',
                  courseName: '测试课程',
                  date: '2026-05-04',
                  isEffective: true,
                  logicalDayOfWeek: 1,
                  periodEnd: 1,
                  periodStart: 1,
                  physicalDayOfWeek: 1,
                  scheduleId: 9001,
                  semesterId: 101,
                  slotId: 9101,
                  staffId: 'staff-1001',
                  staffName: '测试老师',
                  teachingClassName: '测试班级',
                  weekIndex: 1,
                },
              ],
              truncationReason: null,
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

test('学生身份进入首页时，应进入我的工作台周课表内容', async ({ page }) => {
  await openHomeAs(page, { primaryAccessGroup: 'STUDENT' });

  await expect(page.getByRole('heading', { name: '我的工作台' })).toBeVisible();
  await expect(page.getByText('当前账号暂无可展示周课表')).toBeVisible();
  await expect(page.getByText('注意：待办事项暂时保存在本地，无法跨设备展示')).toBeVisible();
  await expect(page.getByRole('link', { name: /教务助手 My 教学日志/ })).toHaveCount(0);
  await expect(page.getByText('成员默认模板')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '打开开始入口' })).toHaveCount(0);
});

test('GUEST 进入首页时，应进入我的工作台周课表内容', async ({ page }) => {
  await openHomeAs(page, { primaryAccessGroup: 'GUEST' });

  await expect(page.getByText('当前账号暂无可展示周课表')).toBeVisible();
  await expect(page.getByRole('link', { name: /教务助手 My 教学日志/ })).toHaveCount(0);
  await expect(page.getByText('最小默认模板')).toHaveCount(0);
});

test('当 accessGroup 包含 ADMIN 时，应优先进入管理默认模板', async ({ page }) => {
  await openHomeAs(page, {
    accessGroup: ['ADMIN', 'STUDENT'],
    primaryAccessGroup: 'STUDENT',
  });

  await expect(page.getByText('管理默认模板')).toBeVisible();
});

test('其他待办可以拖拽到周课表空格，并同步本地存储', async ({ page }) => {
  await page.clock.setFixedTime(fixedWorkbenchDate);
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      accountId: 1001,
      displayName: 'workbench-staff',
      identity: {
        id: 'staff-1001',
        kind: 'STAFF',
        name: '测试老师',
      },
      primaryAccessGroup: 'STAFF',
    },
  });
  await mockHomeWorkbenchTimetableGraphQL(page);
  await seedAuthSession(page, {
    accountId: 1001,
    displayName: 'workbench-staff',
    identity: {
      id: 'staff-1001',
      kind: 'STAFF',
      name: '测试老师',
    },
    primaryAccessGroup: 'STAFF',
  });
  await page.addInitScript(
    ({ storageKey }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify([
          {
            backgroundColor: '#f97316',
            id: 'todo-drag-fixture',
            title: '拖拽待办',
          },
        ]),
      );
    },
    { storageKey: WORKBENCH_TODOS_STORAGE_KEY },
  );

  await page.goto(routes.home);

  await expect(page.getByRole('heading', { name: '我的工作台' })).toBeVisible();
  await expect(page.getByText('测试课程')).toBeVisible();
  await expect(page.getByText('5月04日 - 5月10日')).toBeVisible();
  await expect(page.getByRole('link', { name: /教务助手 My 教学日志/ })).toHaveAttribute(
    'href',
    '/academic-affairs/my-teaching-logs',
  );
  await expect(page.getByRole('button', { name: /显示周[六日]/ })).toHaveCount(0);

  const weekendSwitch = page.getByRole('switch', { name: '显示无课周末' });

  await expect(weekendSwitch).toBeVisible();
  await expect(page.locator('[data-workbench-weekly-timetable-day="6"]')).toHaveCount(0);
  await weekendSwitch.click();
  await expect(page.locator('[data-workbench-weekly-timetable-day="6"]')).toContainText('周六');
  await expect(page.locator('[data-workbench-weekly-timetable-day="7"]')).toContainText('周日');

  const todoItems = page.locator('.home-workbench-todo-items');
  const todoItem = todoItems.locator('.home-workbench-todo-item', { hasText: '拖拽待办' });
  const targetCell = page.locator('.workbench-weekly-timetable-base-cell', {
    has: page.getByRole('button', { name: '添加周一晨会事项' }),
  });

  await expect(todoItem).toBeVisible();
  await todoItem.dragTo(targetCell);

  await expect(todoItems.locator('.home-workbench-todo-item', { hasText: '拖拽待办' })).toHaveCount(
    0,
  );
  await expect(targetCell.locator('.workbench-weekly-timetable-custom-item')).toContainText(
    '拖拽待办',
  );

  const storageSnapshot = await page.evaluate(
    ({ timetableStorageKey, todosStorageKey }) => ({
      timetable: JSON.parse(window.localStorage.getItem(timetableStorageKey) || '[]') as Array<{
        dayOfWeek?: number;
        rowKey?: string;
        title?: string;
      }>,
      todos: JSON.parse(window.localStorage.getItem(todosStorageKey) || '[]') as unknown[],
    }),
    {
      timetableStorageKey: WORKBENCH_TIMETABLE_STORAGE_KEY,
      todosStorageKey: WORKBENCH_TODOS_STORAGE_KEY,
    },
  );

  expect(storageSnapshot.todos).toEqual([]);
  expect(storageSnapshot.timetable).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        dayOfWeek: 1,
        rowKey: 'break-morning',
        title: '拖拽待办',
      }),
    ]),
  );
});
