// e2e/specs/routing/student-evaluation-comment-workbench-lab.spec.ts

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

function buildWorkspace(generating = false, excelSaved = false) {
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
          comment: {
            content: '正式评语正文。',
            revision: { payloadHash: 'a'.repeat(64), payloadVersion: 1 },
            source: 'MANUAL',
            updatedAt: '2026-08-25T01:00:00.000Z',
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

test('产品工作台以学期和状态筛选统一组织生成与审阅', async ({ page }) => {
  await seedAdmin(page);
  let generating = false;
  let generationInput: Record<string, unknown> | null = null;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: Record<string, unknown> } }
      | undefined;
    const query = payload?.query ?? '';

    if (query.includes('query StudentEvaluationCommentProductWorkbench')) {
      await route.fulfill({
        body: JSON.stringify({
          data: { studentEvaluationCommentWorkspace: buildWorkspace(generating) },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('mutation GenerateStudentEvaluationCommentProductDrafts')) {
      generationInput = payload?.variables?.input ?? null;
      generating = true;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            generateStudentEvaluationCommentAiDrafts: {
              counts: {
                accepted: 1,
                alreadyGenerating: 0,
                basisMissing: 0,
                draftExists: 0,
                formalCommentExists: 0,
                requested: 1,
              },
              items: [{ disposition: 'ACCEPTED', studentId: '324010103' }],
              status: 'ACCEPTED',
            },
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsStudentEvaluationCommentWorkbench);

  await expect(page.getByRole('heading', { name: '班级评语工作台' })).toBeVisible();
  await expect(page.getByText('2025-2026 第一学期', { exact: true })).toBeVisible();
  await expect(page.getByText('待处理 1', { exact: true })).toBeVisible();
  await expect(page.getByText('待审阅 1', { exact: true })).toBeVisible();
  await expect(page.getByText('已完成 1', { exact: true })).toBeVisible();

  await page.getByText('待审阅 1', { exact: true }).click();
  await expect(page.getByRole('row', { name: /李四/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /张三/ })).toHaveCount(0);

  await page.getByText('待处理 1', { exact: true }).click();
  const targetRow = page.getByRole('row', { name: /王五/ });
  await targetRow.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'AI 生成 1' }).click();
  await page.getByRole('button', { name: '生成 1 名学生草稿' }).click();

  await expect.poll(() => generationInput).not.toBeNull();
  expect(generationInput).toMatchObject({
    classId: '1021904',
    semesterId: 3,
    studentIds: ['324010103'],
  });
  await expect(page.getByText('生成中 1', { exact: true })).toBeVisible();
});

test('Excel 导入先进入统一列表审阅，再批量保存正式评语', async ({ page }) => {
  await seedAdmin(page);
  let excelSaved = false;
  let writeInput: Record<string, unknown> | null = null;

  await page.route('**/student-evaluation-comments/material-imports', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        data: {
          blockingErrors: [],
          classId: '1021904',
          className: '计算机2024级1班',
          commentKind: 'TERM',
          identityMappingGroups: [],
          previewRows: [
            {
              content: 'Excel 导入后的正式评语。',
              expectedRevision: null,
              matchedBy: 'STUDENT_ID',
              proposedAction: 'CREATE',
              sourceRow: 2,
              sourceSheet: '评语',
              studentId: '324010103',
              studentName: '王五',
            },
          ],
          selectedSheet: '评语',
          semesterId: 3,
          sheetOptions: [],
          status: 'READY_TO_SAVE',
          summary: {
            blankCommentCount: 0,
            createCount: 1,
            matchedRows: 1,
            parsedRows: 1,
            unchangedCount: 0,
            updateCount: 0,
          },
          warnings: [],
        },
      }),
      contentType: 'application/json',
      status: 201,
    });
  });

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: Record<string, unknown> } }
      | undefined;
    const query = payload?.query ?? '';

    if (query.includes('query StudentEvaluationCommentProductWorkbench')) {
      await route.fulfill({
        body: JSON.stringify({
          data: { studentEvaluationCommentWorkspace: buildWorkspace(false, excelSaved) },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('mutation WriteStudentEvaluationCommentProductComments')) {
      writeInput = payload?.variables?.input ?? null;
      excelSaved = true;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            batchWriteStudentEvaluationComments: {
              counts: { created: 1, deleted: 0, unchanged: 0, updated: 0 },
              status: 'UPDATED',
            },
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsStudentEvaluationCommentWorkbench);
  await page.getByRole('button', { name: 'Excel 导入' }).click();
  await page.locator('.ant-modal input[type="file"]').setInputFiles({
    buffer: Buffer.from('xlsx'),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name: '班级评语.xlsx',
  });

  const importedRow = page.getByRole('row', { name: /王五/ });
  await expect(importedRow.getByText('Excel 草稿', { exact: true })).toBeVisible();
  await expect(importedRow.getByText('Excel 导入后的正式评语。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保存导入 1' }).click();
  await page.getByRole('button', { name: '确认保存' }).click();

  await expect.poll(() => writeInput).not.toBeNull();
  expect(writeInput).toMatchObject({
    classId: '1021904',
    commentKind: 'TERM',
    items: [
      {
        action: 'UPSERT',
        content: 'Excel 导入后的正式评语。',
        expectedRevision: null,
        studentId: '324010103',
      },
    ],
    semesterId: 3,
  });
  await expect(page.getByText('已完成 2', { exact: true })).toBeVisible();
});
