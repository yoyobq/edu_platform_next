// e2e/specs/routing/student-evaluation-comments-concurrency.spec.ts

import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const CLASS_OPTION = {
  blockingReasonCode: null,
  blockingReasonMessage: null,
  catalogStatus: 'READY',
  classCode: 'CS2024-01',
  classId: '1021904',
  className: '计算机2024级1班',
  trainingYears: 4,
};

const TERM_OPTION = {
  isCurrent: true,
  label: '2025-2026 第一学期',
  schoolYear: 2025,
  semesterId: 3,
  sequence: 1,
  termNumber: 1,
};

async function seedAdmin(page: Page) {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: { displayName: 'admin-user', primaryAccessGroup: 'ADMIN' },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

function buildWorkspace(generating = false, excelSaved = false, formalDeleted = false) {
  return {
    actions: [
      { action: 'WRITE_COMMENTS', allowed: true, reasonCode: null, reasonMessage: null },
      { action: 'GENERATE_AI_DRAFTS', allowed: true, reasonCode: null, reasonMessage: null },
    ],
    classOptions: [CLASS_OPTION],
    commentKind: 'TERM',
    selectedClass: CLASS_OPTION,
    selectedTerm: TERM_OPTION,
    status: 'READY',
    termOptions: [TERM_OPTION],
    view: {
      classItem: { classCode: 'CS2024-01', className: '计算机2024级1班', id: '1021904' },
      scope: { commentKind: 'TERM', scopeKey: 'TERM:3', semesterId: 3 },
      students: [
        {
          aiDraft: null,
          comment: formalDeleted
            ? null
            : {
                content: '正式评语正文。',
                revision: { payloadHash: 'a'.repeat(64), payloadVersion: 1 },
                source: 'MANUAL',
                updatedAt: '2026-08-25T01:00:00.000Z',
              },
          aiGeneration: {
            status: 'IDLE',
            reasonCode: null as string | null,
            retryAllowed: false,
            updatedAt: null,
            generationVersion: null,
          },
          isAiDraftGenerating: false,
          studentId: '324010101',
          studentName: '张三',
          studentStatus: 'ENROLLED',
        },
        {
          aiDraft: {
            content: '待审阅的 AI 草稿。',
            draftId: '7',
            expiresAt: '2027-08-25T01:00:00.000Z',
            revision: { payloadHash: 'b'.repeat(64), payloadVersion: 1 },
            updatedAt: '2026-08-25T01:00:00.000Z',
          },
          comment: null,
          aiGeneration: {
            status: 'DRAFT_READY',
            reasonCode: null,
            retryAllowed: false,
            updatedAt: '2026-08-25T01:00:00Z',
            generationVersion: null,
          },
          isAiDraftGenerating: false,
          studentId: '324010102',
          studentName: '李四',
          studentStatus: 'ENROLLED',
        },
        {
          aiDraft: null,
          comment: excelSaved
            ? {
                content: 'Excel 导入后的正式评语。',
                revision: { payloadHash: 'c'.repeat(64), payloadVersion: 1 },
                source: 'MANUAL',
                updatedAt: '2026-08-25T02:00:00.000Z',
              }
            : null,
          aiGeneration: {
            status: generating ? 'GENERATING' : 'IDLE',
            reasonCode: null as string | null,
            retryAllowed: false,
            updatedAt: null as string | null,
            generationVersion: generating ? '11111111-1111-4111-8111-111111111111' : null,
          },
          isAiDraftGenerating: generating,
          studentId: '324010103',
          studentName: '王五',
          studentStatus: 'ENROLLED',
        },
      ],
    },
    warnings: [],
  };
}

test('后台刷新后保存编辑仍提交打开时的 revision', async ({ page }) => {
  await seedAdmin(page);
  let changed = false;
  let writeInput: Record<string, unknown> | undefined;
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      query?: string;
      variables?: { input?: Record<string, unknown> };
    };
    if (payload.query?.includes('query StudentEvaluationCommentProductWorkbench')) {
      const workspace = buildWorkspace(true);
      if (changed)
        workspace.view.students[0]!.comment = {
          content: '另一位教师刚刚保存的新评语。',
          revision: { payloadHash: 'd'.repeat(64), payloadVersion: 1 },
          source: 'MANUAL',
          updatedAt: '2026-09-17T01:00:00Z',
        };
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { studentEvaluationCommentWorkspace: workspace } }),
      });
      return;
    }
    if (payload.query?.includes('mutation WriteStudentEvaluationCommentProductComments')) {
      writeInput = payload.variables?.input;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [{ message: '评语已被他人修改', extensions: { code: 'CONFLICT' } }],
        }),
      });
      return;
    }
    await route.fallback();
  });
  await page.goto(routes.studentEvaluationComments);
  await page.getByRole('row', { name: /张三/ }).getByRole('button', { name: '编辑' }).click();
  await page.locator('.ant-drawer textarea').fill('基于旧内容的编辑。');
  changed = true;
  await expect(
    page.getByRole('row', { name: /张三/ }).getByText('另一位教师刚刚保存的新评语。'),
  ).toBeVisible({ timeout: 12000 });
  await expect(page.locator('.ant-drawer textarea')).toHaveValue('基于旧内容的编辑。');
  await page.getByRole('button', { name: '保存正式评语' }).click();
  await expect
    .poll(() => writeInput)
    .toMatchObject({
      items: [
        {
          content: '基于旧内容的编辑。',
          expectedRevision: { payloadHash: 'a'.repeat(64), payloadVersion: 1 },
        },
      ],
    });
  await expect(page.getByText('评语状态已变化，请刷新后重新操作。', { exact: true })).toBeVisible();
  await expect(page.locator('.ant-drawer textarea')).toHaveValue('基于旧内容的编辑。');
});

test('AI 草稿被重新生成后，保存仍引用编辑开始时的草稿和 revision', async ({ page }) => {
  await seedAdmin(page);
  let changed = false;
  let saveInput: Record<string, unknown> | undefined;
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      query?: string;
      variables?: { input?: Record<string, unknown> };
    };
    if (payload.query?.includes('query StudentEvaluationCommentProductWorkbench')) {
      const workspace = buildWorkspace(true);
      const draft = workspace.view.students[1]?.aiDraft;
      if (changed && draft) {
        draft.draftId = 'new-draft';
        draft.content = '重新生成的 AI 草稿。';
        draft.revision = { payloadHash: 'd'.repeat(64), payloadVersion: 1 };
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { studentEvaluationCommentWorkspace: workspace } }),
      });
      return;
    }
    if (payload.query?.includes('mutation SaveStudentEvaluationCommentProductDraft')) {
      saveInput = payload.variables?.input;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [{ message: '草稿已变化', extensions: { code: 'CONFLICT' } }],
        }),
      });
      return;
    }
    await route.fallback();
  });
  await page.goto(routes.studentEvaluationComments);
  await page.getByRole('row', { name: /李四/ }).getByRole('button', { name: '审阅' }).click();
  await page.locator('.ant-drawer textarea').fill('原草稿上的修改。');
  changed = true;
  await expect(
    page.getByRole('row', { name: /李四/ }).getByText('重新生成的 AI 草稿。'),
  ).toBeVisible({ timeout: 12000 });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /保存草稿/ })
    .click();
  await expect
    .poll(() => saveInput)
    .toMatchObject({
      draftId: '7',
      content: '原草稿上的修改。',
      expectedRevision: { payloadHash: 'b'.repeat(64), payloadVersion: 1 },
    });
  await expect(page.getByText('评语状态已变化，请刷新后重新操作。', { exact: true })).toBeVisible();
  await expect(page.locator('.ant-drawer textarea')).toHaveValue('原草稿上的修改。');
});

test('上传期间刷新后应按最新 workspace 预填 Excel 草稿', async ({ page }) => {
  await seedAdmin(page);
  let changed = false;
  const uploadStarted = createDeferred();
  const releaseUpload = createDeferred();
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string };
    if (payload.query?.includes('query StudentEvaluationCommentProductWorkbench')) {
      const workspace = buildWorkspace(true);
      if (changed)
        workspace.view.students[0]!.comment = {
          content: '另一位教师刚刚保存的新评语。',
          revision: { payloadHash: 'd'.repeat(64), payloadVersion: 1 },
          source: 'MANUAL',
          updatedAt: '2026-09-17T01:00:00Z',
        };
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { studentEvaluationCommentWorkspace: workspace } }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route('**/student-evaluation-comments/material-imports', async (route) => {
    uploadStarted.resolve();
    await releaseUpload.promise;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          status: 'READY_TO_SAVE',
          selectedSheet: '评语',
          sheetOptions: [],
          identityMappingGroups: [],
          blockingErrors: [],
          warnings: [],
          classId: CLASS_OPTION.classId,
          className: CLASS_OPTION.className,
          commentKind: 'TERM',
          semesterId: 3,
          previewRows: [
            {
              studentId: '324010101',
              studentName: '张三',
              content: '导入的新评语。',
              expectedRevision: { payloadHash: 'd'.repeat(64), payloadVersion: 1 },
              matchedBy: 'STUDENT_ID',
              proposedAction: 'UPDATE',
              sourceRow: 2,
              sourceSheet: '评语',
            },
          ],
          summary: {
            blankCommentCount: 0,
            createCount: 0,
            matchedRows: 1,
            parsedRows: 1,
            unchangedCount: 0,
            updateCount: 1,
          },
        },
      }),
    });
  });
  await page.goto(routes.studentEvaluationComments);
  await page.getByRole('button', { name: 'Excel 导入' }).click();
  await page.locator('.ant-modal input[type="file"]').setInputFiles({
    buffer: Buffer.from('xlsx'),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name: '评语.xlsx',
  });
  await uploadStarted.promise;
  changed = true;
  await expect(
    page.getByRole('row', { name: /张三/ }).getByText('另一位教师刚刚保存的新评语。'),
  ).toBeVisible({ timeout: 12000 });
  releaseUpload.resolve();
  await expect(
    page.getByText('正式评语已发生变化，请重新加载工作台后重新上传 Excel。', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('row', { name: /张三/ }).getByText('Excel 草稿', { exact: true }),
  ).toBeVisible();
});
