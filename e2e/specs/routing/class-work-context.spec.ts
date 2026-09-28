// e2e/specs/routing/class-work-context.spec.ts
import type { Locator, Page } from '@playwright/test';

import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const CARD = '/labs/student-registration-cards';
const COMMENTS = '/class-affairs/student-evaluation-comments';
const KEY = 'edu-mate.class-work.v1:1';
const classes = [
  {
    id: 'A',
    classId: 'A',
    classCode: '2401',
    className: '护理一班',
    gradeYear: 2024,
    trainingYears: 3,
    catalogStatus: 'READY',
    blockingReasonCode: null,
    blockingReasonMessage: null,
    studentCount: 1,
    classAdvisers: [],
    majorName: '护理',
    classInSchool: true,
  },
  {
    id: 'B',
    classId: 'B',
    classCode: '2402',
    className: '护理二班',
    gradeYear: 2024,
    trainingYears: 3,
    catalogStatus: 'READY',
    blockingReasonCode: null,
    blockingReasonMessage: null,
    studentCount: 1,
    classAdvisers: [],
    majorName: '护理',
    classInSchool: true,
  },
];
const term = {
  semesterId: 3,
  sequence: 1,
  label: '2025-2026 第一学期',
  schoolYear: 2025,
  termNumber: 1,
  isCurrent: true,
};

async function setup(page: Page, single = false) {
  await page.setViewportSize({ width: 1500, height: 1050 });
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: { accountId: 1, primaryAccessGroup: 'ADMIN' } });
  await seedAuthSession(page, { accountId: 1, primaryAccessGroup: 'ADMIN' });
  const requests: { field: string; input: Record<string, unknown> }[] = [];
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      query?: string;
      variables?: { input?: Record<string, unknown> };
    };
    const query = payload.query ?? '';
    const input = payload.variables?.input ?? {};
    const options = single ? classes.slice(0, 1) : classes;
    const selected = options.find((item) => item.id === input.classId) ?? options[0];
    const base = {
      status: 'READY',
      classOptions: options,
      selectedClass: selected,
      termOptions: [term],
      selectedTerm: term,
      actions: [],
      warnings: [],
      view: null,
    };
    let field = '';
    let value: unknown;
    if (query.includes('studentPrivateProfileClassOptions')) {
      field = 'studentPrivateProfileClassOptions';
      value = options;
    } else if (query.includes('studentPrivateProfileClassStudentOptions')) {
      field = 'studentPrivateProfileClassStudentOptions';
      value = [{ studentId: 'S1', studentName: '张同学' }];
    } else if (query.includes('studentRegistrationCardGenerationPreflight')) {
      field = 'studentRegistrationCardGenerationPreflight';
      value = {
        studentId: input.studentId,
        canGenerate: true,
        status: 'WARNING',
        issueCodes: [],
        warningCodes: ['TERM_EVALUATION_COMMENT_MISSING'],
        missingSections: [],
        scoreOverflows: [],
        termMaterialReadiness: {
          status: 'READY',
          terms: [{ ...term, evaluationCommentStatus: 'MISSING', conductGradeStatus: 'READY' }],
        },
      };
    } else if (query.includes('studentEvaluationCommentWorkspace')) {
      field = 'studentEvaluationCommentWorkspace';
      value = {
        ...base,
        commentKind: 'TERM',
        actions: [{ action: 'WRITE_COMMENTS', allowed: true }],
        view: {
          classItem: selected,
          scope: { scopeKey: `${selected.id}-3`, semesterId: 3, commentKind: 'TERM' },
          students: [
            {
              studentId: 'S1',
              studentName: '张同学',
              studentStatus: 'ENROLLED',
              comment: null,
              aiDraft: null,
              aiGeneration: {
                status: 'IDLE',
                reasonCode: null,
                retryAllowed: false,
                updatedAt: null,
                generationVersion: null,
              },
              isAiDraftGenerating: false,
            },
          ],
        },
      };
    } else if (query.includes('studentConductGradeWorkspace')) {
      field = 'studentConductGradeWorkspace';
      const missing = { value: null, source: 'MISSING', conflict: null };
      value = {
        ...base,
        actions: [{ action: 'PATCH_CORRECTIONS', allowed: true }],
        view: {
          classId: selected.id,
          classCode: selected.classCode,
          className: selected.className,
          schoolYear: '2025',
          semester: '1',
          sectionKey: '2025-1',
          studentCount: 1,
          rosterEligibilitySummary: {
            inScopeCount: 1,
            excludedAfterExitCount: 0,
            excludedBeforeEntryCount: 0,
            excludedNotCheckedInCount: 0,
            unresolvedEffectiveSemesterCount: 0,
          },
          students: [
            {
              studentId: 'S1',
              studentName: '张同学',
              studentStatus: 'ENROLLED',
              mainSnapshotPresent: true,
              status: 'MISSING',
              manualPatchFieldKeys: [],
              conflictCodes: [],
              conductSection: {
                snapshotPresent: true,
                sourceStatus: 'SUCCESS',
                sourceTotal: 0,
                warningCodes: [],
              },
              fields: { score: missing, confirmedGrade: missing, estimatedGrade: missing },
            },
          ],
        },
      };
    } else if (query.includes('classCourseGradeWorkspace')) {
      field = 'classCourseGradeWorkspace';
      value = base;
    } else if (query.includes('studentPrivateProfileClassOverview')) {
      field = 'studentPrivateProfileClassOverview';
      value = { ...selected, classId: selected.id, students: [], studentCount: 0 };
    }
    if (!field) {
      await route.fallback();
      return;
    }
    requests.push({ field, input });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { [field]: value } }),
    });
  });
  return requests;
}
async function showSelector(page: Page) {
  const group = page.getByRole('menuitem', { name: /班务管理$/ });
  await expect(group).toBeVisible();
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
  await expect(page.getByRole('combobox', { name: '工作班级' })).toBeVisible();
}
async function chooseClassOption(page: Page, select: Locator, name: RegExp) {
  await select.click();
  await expect(select).toHaveAttribute('aria-expanded', 'true');
  const listId = await select.getAttribute('aria-controls');
  const popup = page
    .locator('.ant-select-dropdown')
    .filter({ has: page.locator(`[id="${listId}"]`) });
  await popup.locator('.ant-select-item-option-content').filter({ hasText: name }).click();
}
async function setWorkClass(page: Page, name: string) {
  await showSelector(page);
  await chooseClassOption(page, page.getByRole('combobox', { name: '工作班级' }), new RegExp(name));
}

test('工作班级跨页跟随，页面临时切班不改变默认，刷新后仍保留', async ({ page }) => {
  const requests = await setup(page);
  await page.goto(COMMENTS);
  await setWorkClass(page, '护理二班');
  await expect
    .poll(
      () =>
        requests.filter((r) => r.field === 'studentEvaluationCommentWorkspace').at(-1)?.input
          .classId,
    )
    .toBe('B');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('B');
  await chooseClassOption(
    page,
    page.getByRole('combobox').filter({ visible: true }).nth(1),
    /护理一班/,
  );
  await expect(page.getByText('临时查看', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('B');
  await page.getByRole('menuitem', { name: '成绩汇总', exact: true }).click();
  await expect
    .poll(
      () => requests.filter((r) => r.field === 'classCourseGradeWorkspace').at(-1)?.input.classId,
    )
    .toBe('B');
  await page.getByRole('menuitem', { name: '学生建档', exact: true }).click();
  await expect
    .poll(
      () =>
        requests.filter((r) => r.field === 'studentPrivateProfileClassOverview').at(-1)?.input
          .classId,
    )
    .toBe('B');
  await page.getByRole('menuitem', { name: '操行对齐', exact: true }).click();
  await expect
    .poll(
      () =>
        requests.filter((r) => r.field === 'studentConductGradeWorkspace').at(-1)?.input.classId,
    )
    .toBe('B');
  await page.reload();
  await expect
    .poll(
      () =>
        requests.filter((r) => r.field === 'studentConductGradeWorkspace').at(-1)?.input.classId,
    )
    .toBe('B');
  await page.getByRole('menuitem', { name: '评语治理', exact: true }).click();
  await expect(page.getByRole('button', { name: /填写$/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/class-work-demo-full.png', fullPage: false });
  await page.getByRole('button', { name: '收起导航菜单' }).click();
  await page.getByRole('menuitem', { name: /班务管理$/ }).hover();
  await expect(page.getByRole('combobox', { name: '工作班级' })).toBeVisible();
  await page.getByRole('combobox', { name: '工作班级' }).click();
  await page.screenshot({ path: '/tmp/class-work-demo-rail.png', fullPage: false });
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(/护理一班/)
    .last()
    .click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('A');
});

test('单班自动选择；学籍卡缺项跳转保留范围，返回自动重新检查', async ({ page }) => {
  const requests = await setup(page, true);
  await page.goto(CARD);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('A');
  await page.getByRole('combobox', { name: '学籍卡学生' }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(/张同学/)
    .last()
    .click();
  await page.getByRole('button', { name: '检查最终材料' }).click();
  await page.getByRole('link', { name: '缺失 · 去补齐' }).click();
  await expect(page).toHaveURL(/classId=A.*semesterId=3.*studentId=S1/);
  await expect(page.getByPlaceholder('搜索姓名或学号')).toHaveValue('S1');
  await page.getByRole('button', { name: /返回学籍卡检查$/ }).click();
  await expect(page).toHaveURL(/student-registration-cards/);
  await expect(page.getByText('可以出卡，但有材料提醒', { exact: true })).toBeVisible();
  await expect
    .poll(
      () => requests.filter((r) => r.field === 'studentRegistrationCardGenerationPreflight').length,
    )
    .toBe(2);
});

test('未保存评语阻止离开，取消后保留输入与工作班级', async ({ page }) => {
  await setup(page, true);
  await page.goto(CARD);
  await showSelector(page);
  await page.getByRole('menuitem', { name: '评语治理', exact: true }).click();
  await page.getByRole('button', { name: /填写$/ }).click();
  await page.getByRole('textbox').fill('尚未保存的评语内容');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: '存在未保存内容' })).toBeVisible();
  await page.getByRole('button', { name: '留在当前页' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('尚未保存的评语内容');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('A');
});

test('菜单切班遇到手工操行草稿，取消不改工作班级，确认后才保存新班级', async ({ page }) => {
  await setup(page);
  await page.goto('/class-affairs/student-conduct-alignment');
  await setWorkClass(page, '护理一班');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('A');
  await page.getByRole('button', { name: /补录$/, exact: false }).click();
  await page.getByRole('row').filter({ hasText: '张同学' }).getByRole('textbox').fill('88');
  await setWorkClass(page, '护理二班');
  await expect(page.getByRole('dialog', { name: '放弃未保存的操行补录？' })).toBeVisible();
  await page.getByRole('button', { name: '留在当前页' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: '张同学' }).getByRole('textbox'),
  ).toHaveValue('88');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('A');
  await setWorkClass(page, '护理二班');
  await page.getByRole('button', { name: '放弃并切换' }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('B');
  await expect(page).toHaveURL(/classId=B/);
});

test('已保存班级失效时清除旧值并提示重选', async ({ page }) => {
  await setup(page, true);
  await page.addInitScript((key) => localStorage.setItem(key, 'retired-class'), KEY);
  await page.goto(COMMENTS);
  await showSelector(page);
  await expect(page.getByText('原工作班级已不可用，请重新选择。')).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
});
