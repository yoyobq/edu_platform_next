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

const UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.upstream.session.v2';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

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

function buildEnvelope(
  staffId: string,
  staffName: string,
  classroomName: string | null = '知行楼 302',
) {
  return {
    invalidReason: null,
    isComplete: true,
    isValid: true,
    items: [
      { ...buildOccurrence(staffId, staffName), classroomName },
      {
        ...buildOccurrence(staffId, staffName),
        classroomName,
        periodEnd: 4,
        periodStart: 3,
        slotId: 9002,
      },
      {
        ...buildOccurrence(staffId, staffName),
        classroomName,
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
  await page.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    {
      key: UPSTREAM_SESSION_STORAGE_KEY,
      session: {
        accountId: 1001,
        expiresAt: '2027-01-01T00:00:00.000Z',
        upstreamLoginId: 'staff-1001',
        upstreamSessionToken: 'upstream-token-1',
        version: 2,
      },
    },
  );
  let requestedSemesterId: number | null = null;
  let managedQueryCount = 0;
  let historyReferenceInput: Record<string, unknown> | null = null;
  let updatedClassroomInput: { classroomName: string; scheduleId: number } | null = null;
  const classroomUpdate = createDeferred();

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: {
            context?: Record<string, unknown>;
            input?: { classroomName: string; scheduleId: number };
            semesterId?: number;
            upstreamSessionToken?: string;
          };
        }
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

    if (query.includes('query MyAcademicCurriculumPlanDetailReferenceCandidates')) {
      historyReferenceInput = payload?.variables ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            listMyAcademicCurriculumPlanDetailReferenceCandidates: {
              expiresAt: '2027-01-01T01:00:00.000Z',
              upstreamSessionToken: 'upstream-token-2',
              warnings: [],
              items: [
                {
                  courseName: '数据库原理',
                  items: [
                    {
                      chapterAndContent: '历史内容 1',
                      dayOfWeek: 2,
                      homework: '历史作业 1',
                      lessonHours: 2,
                      sectionId: '1,2',
                      sectionName: '第一、二节',
                      sourceDetailId: 'DETAIL-1',
                      weekNumber: 1,
                    },
                    {
                      chapterAndContent: '历史内容 2',
                      dayOfWeek: 2,
                      homework: '历史作业 2',
                      lessonHours: 2,
                      sectionId: '3,4',
                      sectionName: '第三、四节',
                      sourceDetailId: 'DETAIL-2',
                      weekNumber: 1,
                    },
                    {
                      chapterAndContent: '历史内容 3',
                      dayOfWeek: 2,
                      homework: '历史作业 3',
                      lessonHours: 2,
                      sectionId: '5,6',
                      sectionName: '第五、六节',
                      sourceDetailId: 'DETAIL-3',
                      weekNumber: 2,
                    },
                  ],
                  matchKind: 'EXACT',
                  plannedLessons: 4,
                  plannedLessonsDiff: 0,
                  rank: 1,
                  recommended: true,
                  schoolYear: '2025',
                  semester: '2',
                  sourcePlanId: 'PLAN-HISTORY-1',
                  teachingClassName: '软件 2301',
                  weekCount: 1,
                  weeklyHours: 4,
                },
              ],
            },
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('mutation UpdateAcademicCourseScheduleClassroomName')) {
      updatedClassroomInput = payload?.variables?.input ?? null;
      await classroomUpdate.promise;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            updateAcademicCourseScheduleClassroomName: updatedClassroomInput,
          },
        }),
        contentType: 'application/json',
      });
      return;
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
  await expect(page.getByPlaceholder('填写授课章节与内容')).toHaveCount(2);
  await expect(page.getByPlaceholder('填写课外作业')).toHaveCount(2);
  await expect(page.getByText('输入姓名或工号选择教师', { exact: true })).toHaveCount(0);
  await expect(page.getByText('逐课次内容仍是限时本地草稿，请及时导出')).toBeVisible();
  await expect(page.getByText(/统一授课地点会保存到服务器/)).toBeVisible();

  const firstChapter = page.getByLabel('2026-09-08第1,2节授课章节与内容');
  await firstChapter.fill('教师已填写内容');
  await page.getByRole('button', { name: '参考历史计划' }).click();
  const historyDialog = page.getByRole('dialog', { name: /选择“数据库原理”的历史教学计划/ });
  await expect(historyDialog.getByText('2025 学年第 2 学期')).toBeVisible();
  await historyDialog.getByRole('button', { name: '替换当前内容' }).click();
  const replaceDialog = page.getByRole('dialog', { name: '替换当前章节与作业？' });
  await expect(replaceDialog.getByText(/当前有 2 行章节与作业，历史计划有 3 行/)).toBeVisible();
  await replaceDialog.getByRole('button', { name: '确认替换' }).click();
  await expect(firstChapter).toHaveValue('历史内容 1');
  await expect(page.getByLabel('2026-09-08第1,2节课外作业')).toHaveValue('历史作业 1');
  await expect(page.getByLabel('2026-09-08第3,4节授课章节与内容')).toHaveValue('历史内容 2');
  await expect(page.getByLabel('2026-09-08第3,4节课外作业')).toHaveValue('历史作业 2');
  await expect(page.getByLabel('第3行授课章节与内容')).toHaveValue('历史内容 3');
  await expect(page.getByLabel('第3行课外作业')).toHaveValue('历史作业 3');
  await expect(page.getByLabel('第3行无正式授课数据')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 Excel' })).toBeDisabled();

  const thirdDragHandle = page.getByRole('button', { name: '拖动第3行章节与作业' });
  const firstChapterBox = await firstChapter.boundingBox();
  expect(firstChapterBox).not.toBeNull();
  const dragData = await page.evaluateHandle(() => new DataTransfer());
  await thirdDragHandle.dispatchEvent('dragstart', { dataTransfer: dragData });
  await firstChapter.dispatchEvent('dragover', {
    clientY: firstChapterBox!.y,
    dataTransfer: dragData,
  });
  await expect(firstChapter.locator('xpath=ancestor::td')).toHaveClass(/border-t-primary/);
  await firstChapter.dispatchEvent('drop', {
    clientY: firstChapterBox!.y,
    dataTransfer: dragData,
  });
  await thirdDragHandle.dispatchEvent('dragend', { dataTransfer: dragData });
  await expect(firstChapter).toHaveValue('历史内容 3');
  await expect(page.getByLabel('2026-09-08第1,2节课外作业')).toHaveValue('历史作业 3');

  await page.getByRole('button', { name: '删除第3行章节与作业' }).click();
  await expect(page.getByPlaceholder('填写授课章节与内容')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '导出 Excel' })).toBeEnabled();
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByPlaceholder('填写授课章节与内容')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '导出 Excel' })).toBeDisabled();
  await page.getByRole('button', { name: '删除第3行章节与作业' }).click();
  await expect(page.getByRole('button', { name: '导出 Excel' })).toBeEnabled();

  await page.getByRole('button', { name: '删除第2行章节与作业' }).click();
  const secondChapter = page.getByLabel('2026-09-08第3,4节授课章节与内容');
  const secondChapterBox = await secondChapter.boundingBox();
  expect(secondChapterBox).not.toBeNull();
  const emptySlotDragData = await page.evaluateHandle(() => new DataTransfer());
  await page
    .getByRole('button', { name: '拖动第1行章节与作业' })
    .dispatchEvent('dragstart', { dataTransfer: emptySlotDragData });
  await secondChapter.dispatchEvent('dragover', {
    clientY: secondChapterBox!.y,
    dataTransfer: emptySlotDragData,
  });
  await expect(secondChapter.locator('xpath=ancestor::td')).toHaveClass(/border-y-primary/);
  await secondChapter.dispatchEvent('drop', {
    clientY: secondChapterBox!.y,
    dataTransfer: emptySlotDragData,
  });
  await page
    .getByRole('button', { name: '拖动第2行章节与作业' })
    .dispatchEvent('dragend', { dataTransfer: emptySlotDragData });
  await expect(firstChapter).toHaveValue('');
  await expect(secondChapter).toHaveValue('历史内容 3');
  await expect(page.getByRole('button', { name: '导出 Excel' })).toBeDisabled();

  await page.getByRole('button', { name: '创建第1行章节与作业' }).click();
  await firstChapter.fill('历史内容 1');
  await page.getByLabel('2026-09-08第1,2节课外作业').fill('历史作业 1');
  await expect(page.getByRole('button', { name: '导出 Excel' })).toBeEnabled();
  expect(historyReferenceInput).toEqual({
    context: {
      courseName: '数据库原理',
      plannedLessons: 4,
      schoolYear: '2026',
      semester: '1',
    },
    upstreamSessionToken: 'upstream-token-1',
  });

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
  await expect(firstLocation).toHaveValue('知行楼 302');
  await expect(secondLocation).toHaveValue('知行楼 302');

  await firstLocation.fill('临时教室 201');
  await firstLocation.press('Tab');
  await expect(firstLocation).toHaveValue('临时教室 201');
  await expect(secondLocation).toHaveValue('知行楼 302');

  await page.getByRole('button', { name: '统一修改授课地点' }).click();
  const unifiedClassroomInput = page.getByLabel('统一授课地点');
  await expect(unifiedClassroomInput).toHaveValue('知行楼 302');
  await unifiedClassroomInput.fill('机房 5102');
  await unifiedClassroomInput.press('Enter');

  await expect(firstLocation).toBeDisabled();
  await expect(secondLocation).toBeDisabled();
  classroomUpdate.resolve();

  await expect
    .poll(() => updatedClassroomInput)
    .toEqual({
      classroomName: '机房 5102',
      scheduleId: 901,
    });
  await expect(firstLocation).toHaveValue('机房 5102');
  await expect(secondLocation).toHaveValue('机房 5102');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Excel' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('软件 2401-数据库原理-教学计划.xls');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const { default: XLSX } = await import('xlsx');
  const workbook = XLSX.readFile(downloadPath!);
  const worksheet = workbook.Sheets['教学计划'];
  expect(worksheet).toBeDefined();
  const exportedRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet!, {
    defval: '',
    header: 1,
    raw: true,
  });

  expect(exportedRows[0]).toEqual([
    '授课时间',
    '学时数',
    '节次',
    '授课方式',
    '授课地点',
    '授课章节与内容',
    '课外作业',
  ]);
  expect(exportedRows[1]).toEqual([
    '2026-09-08',
    2,
    '1,2',
    '线下',
    '机房 5102',
    '历史内容 1',
    '历史作业 1',
  ]);
  expect(exportedRows[2]).toEqual([
    '2026-09-08',
    2,
    '3,4',
    '线下',
    '机房 5102',
    '历史内容 3',
    '历史作业 3',
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

test('后端无授课地点时，首次填写应保存并成为本课程统一地点', async ({ page }) => {
  await seedStaff(page);
  let updatedClassroomInput: { classroomName: string; scheduleId: number } | null = null;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | {
          query?: string;
          variables?: { input?: { classroomName: string; scheduleId: number } };
        }
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
      await route.fulfill({
        body: JSON.stringify({
          data: {
            listMyAcademicSemesterPlannedTimetable: buildEnvelope('staff-1001', '王老师', null),
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('mutation UpdateAcademicCourseScheduleClassroomName')) {
      updatedClassroomInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: { updateAcademicCourseScheduleClassroomName: updatedClassroomInput },
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsMyTeachingPlan);

  const firstLocation = page.getByLabel('2026-09-08第1,2节授课地点');
  const secondLocation = page.getByLabel('2026-09-08第3,4节授课地点');
  await expect(page.getByRole('button', { name: '统一修改授课地点' })).toHaveCount(0);

  await firstLocation.fill('实验楼 101');
  await firstLocation.press('Tab');

  await expect
    .poll(() => updatedClassroomInput)
    .toEqual({
      classroomName: '实验楼 101',
      scheduleId: 901,
    });
  await expect(firstLocation).toHaveValue('实验楼 101');
  await expect(secondLocation).toHaveValue('实验楼 101');
  await expect(page.getByRole('button', { name: '统一修改授课地点' })).toBeVisible();
});
