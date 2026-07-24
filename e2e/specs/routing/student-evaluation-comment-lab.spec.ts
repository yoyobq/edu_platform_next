// e2e/specs/routing/student-evaluation-comment-lab.spec.ts

import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const ORIGINAL_REVISION = {
  payloadHash: 'a'.repeat(64),
  payloadVersion: 1,
};

const IMPORT_REVISION = {
  payloadHash: 'b'.repeat(64),
  payloadVersion: 2,
};

const CLASS_OPTION = {
  blockingReasonCode: null,
  blockingReasonMessage: null,
  catalogStatus: 'READY',
  classCode: 'CS2024-01',
  classId: '1021904',
  className: '计算机2024级1班',
  departmentId: 'D001',
  gradeYear: 2024,
  majorId: 'M001',
  majorName: '计算机科学与技术',
  trainingYears: 4,
};

const TERM_OPTION = {
  isCurrent: true,
  label: '2025-2026 第一学期',
  schoolYear: 2025,
  semesterId: 202501,
  sequence: 1,
  termNumber: 1,
};

function buildClassScope(content: string, revision = ORIGINAL_REVISION) {
  return {
    classItem: {
      classCode: 'CS2024-01',
      className: '计算机2024级1班',
      id: '1021904',
    },
    scope: {
      commentKind: 'TERM',
      scopeKey: 'TERM:202501',
      semesterId: 202501,
    },
    students: [
      {
        comment: {
          content,
          revision,
          source: 'MANUAL',
          updatedAt: '2026-07-16T01:02:03.000Z',
        },
        studentId: '324010112',
        studentName: '张三',
        studentStatus: 'ENROLLED',
      },
      {
        comment: null,
        studentId: '324010113',
        studentName: '李四',
        studentStatus: 'ENROLLED',
      },
    ],
  };
}

function buildWorkspace(content: string, revision = ORIGINAL_REVISION) {
  return {
    actions: [
      {
        action: 'WRITE_COMMENTS',
        allowed: true,
        reasonCode: null,
        reasonMessage: null,
      },
    ],
    classOptions: [CLASS_OPTION],
    commentKind: 'TERM',
    selectedClass: CLASS_OPTION,
    selectedTerm: TERM_OPTION,
    status: 'READY',
    termOptions: [TERM_OPTION],
    view: buildClassScope(content, revision),
    warnings: [],
  };
}

function buildMaterialImportResult(overrides: Record<string, unknown> = {}) {
  return {
    blockingErrors: [],
    classId: '1021904',
    className: '计算机2024级1班',
    commentKind: 'TERM',
    identityMappingGroups: [],
    previewRows: [],
    selectedSheet: null,
    semesterId: 202501,
    sheetOptions: [],
    status: 'NO_CHANGES',
    summary: {
      blankCommentCount: 0,
      createCount: 0,
      matchedRows: 0,
      parsedRows: 0,
      unchangedCount: 0,
      updateCount: 0,
    },
    warnings: [],
    ...overrides,
  };
}

async function seedAdmin(page: Page) {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'admin-user',
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
  });
}

test('管理员可按班级读取差异行、回传 revision 并在保存后重新读取', async ({ page }) => {
  await seedAdmin(page);

  let workspaceReadCount = 0;
  let mutationInput: Record<string, unknown> | null = null;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: Record<string, unknown> } }
      | undefined;
    const query = payload?.query ?? '';

    if (query.includes('query StudentEvaluationCommentWorkspace')) {
      workspaceReadCount += 1;
      const result =
        workspaceReadCount === 1
          ? buildWorkspace('原始正式评语。')
          : buildWorkspace('更新后的正式评语。', {
              payloadHash: 'b'.repeat(64),
              payloadVersion: 1,
            });

      await route.fulfill({
        body: JSON.stringify({
          data: { studentEvaluationCommentWorkspace: result },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('mutation BatchWriteStudentEvaluationComments')) {
      mutationInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            batchWriteStudentEvaluationComments: {
              counts: { created: 0, deleted: 0, unchanged: 0, updated: 1 },
              items: [{ status: 'UPDATED', studentId: '324010112' }],
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

  await page.goto(routes.labsStudentEvaluationComment);

  await expect(page.getByRole('heading', { name: '学生正式评语' })).toBeVisible();

  const textarea = page.getByRole('textbox', { name: '张三正式评语' });
  await expect(textarea).toHaveValue('原始正式评语。');
  await textarea.fill('更新后的正式评语。');
  await expect(page.getByText('1 项未保存')).toBeVisible();
  await page.getByRole('button', { name: '保存 1' }).click();

  await expect(textarea).toHaveValue('更新后的正式评语。');
  await expect(page.getByText('全部已同步')).toBeVisible();
  expect(workspaceReadCount).toBe(2);
  expect(mutationInput).toEqual({
    classId: '1021904',
    commentKind: 'TERM',
    items: [
      {
        action: 'UPSERT',
        content: '更新后的正式评语。',
        expectedRevision: ORIGINAL_REVISION,
        studentId: '324010112',
      },
    ],
    semesterId: 202501,
  });
});

test('CAS 冲突时保留本地草稿并给出重新加载入口', async ({ page }) => {
  await seedAdmin(page);

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;
    const query = payload?.query ?? '';

    if (query.includes('query StudentEvaluationCommentWorkspace')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            studentEvaluationCommentWorkspace: buildWorkspace('原始正式评语。'),
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('mutation BatchWriteStudentEvaluationComments')) {
      await route.fulfill({
        body: JSON.stringify({
          errors: [
            {
              extensions: { code: 'CONFLICT' },
              message: '请求失败',
            },
          ],
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsStudentEvaluationComment);

  const textarea = page.getByRole('textbox', { name: '张三正式评语' });
  await textarea.fill('本地冲突草稿。');
  await page.getByRole('button', { name: '保存 1' }).click();

  await expect(page.getByText('评语已被其他人修改，请重新加载当前班级数据。')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新加载并放弃草稿' })).toBeVisible();
  await expect(textarea).toHaveValue('本地冲突草稿。');
});

test('Excel 导入可完成工作表选择、重名映射并携带 dry-run revision 保存', async ({ page }) => {
  await seedAdmin(page);

  let workspaceReadCount = 0;
  let mutationInput: Record<string, unknown> | null = null;
  const importBodies: string[] = [];
  let importRequestCount = 0;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: Record<string, unknown> } }
      | undefined;
    const query = payload?.query ?? '';

    if (query.includes('query StudentEvaluationCommentWorkspace')) {
      workspaceReadCount += 1;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            studentEvaluationCommentWorkspace:
              workspaceReadCount === 1
                ? buildWorkspace('原始正式评语。')
                : buildWorkspace('Excel 导入评语。', IMPORT_REVISION),
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('mutation BatchWriteStudentEvaluationComments')) {
      mutationInput = payload?.variables?.input ?? null;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            batchWriteStudentEvaluationComments: {
              counts: { created: 0, deleted: 0, unchanged: 0, updated: 1 },
              items: [{ status: 'UPDATED', studentId: '324010112' }],
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

  await page.route('**/student-evaluation-comments/material-imports', async (route) => {
    importRequestCount += 1;
    importBodies.push(route.request().postDataBuffer()?.toString('utf8') ?? '');

    const result =
      importRequestCount === 1
        ? buildMaterialImportResult({
            sheetOptions: [
              { candidateRowCount: 2, recognitionMode: 'DATA_FIRST', sheetName: '评语' },
              { candidateRowCount: 2, recognitionMode: 'HEADER', sheetName: '备用' },
            ],
            status: 'SHEET_SELECTION_REQUIRED',
          })
        : importRequestCount === 2
          ? buildMaterialImportResult({
              identityMappingGroups: [
                {
                  candidates: [
                    { studentId: '324010112', studentName: '张三' },
                    { studentId: '324010113', studentName: '李四' },
                  ],
                  mappingKey: 'c'.repeat(64),
                  sourceRows: [2],
                  sourceStudentName: '张三',
                  sourceStudentNumber: null,
                },
              ],
              selectedSheet: '评语',
              status: 'IDENTITY_MAPPING_REQUIRED',
            })
          : buildMaterialImportResult({
              previewRows: [
                {
                  content: 'Excel 导入评语。',
                  expectedRevision: ORIGINAL_REVISION,
                  matchedBy: 'MANUAL',
                  proposedAction: 'UPDATE',
                  sourceRow: 2,
                  sourceSheet: '评语',
                  studentId: '324010112',
                  studentName: '张三',
                },
              ],
              selectedSheet: '评语',
              status: 'READY_TO_SAVE',
              summary: {
                blankCommentCount: 0,
                createCount: 0,
                matchedRows: 1,
                parsedRows: 1,
                unchangedCount: 0,
                updateCount: 1,
              },
            });

    await route.fulfill({
      body: JSON.stringify({ data: result, requestId: `req-${importRequestCount}` }),
      contentType: 'application/json',
    });
  });

  await page.goto(routes.labsStudentEvaluationComment);
  const textarea = page.getByRole('textbox', { name: '张三正式评语' });
  await expect(textarea).toHaveValue('原始正式评语。');

  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('xlsx'),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name: '评语.xlsx',
  });

  await expect(page.getByText('检测到多个可识别工作表')).toBeVisible();
  await page.getByLabel('选择评语工作表').click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '按此工作表继续' }).click();

  await expect(page.getByText('存在重名学生，请确认对应身份', { exact: true })).toBeVisible();
  await page.getByLabel('张三对应学生').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '确认身份并继续' }).click();

  await expect(textarea).toHaveValue('Excel 导入评语。');
  await expect(page.getByText('Excel 内容已合并到页面草稿，请检查后保存')).toBeVisible();
  await page.getByRole('button', { name: '保存 1' }).click();

  await expect(textarea).toHaveValue('Excel 导入评语。');
  expect(importRequestCount).toBe(3);
  expect(importBodies[0]).toContain('name="semesterId"');
  expect(importBodies[1]).toContain('name="selectedSheet"');
  expect(importBodies[1]).toContain('评语');
  expect(importBodies[2]).toContain('name="identityMappings"');
  expect(importBodies[2]).toContain('324010112');
  expect(mutationInput).toEqual({
    classId: '1021904',
    commentKind: 'TERM',
    items: [
      {
        action: 'UPSERT',
        content: 'Excel 导入评语。',
        expectedRevision: ORIGINAL_REVISION,
        studentId: '324010112',
      },
    ],
    semesterId: 202501,
  });
});

test('BLOCKED 导入展示源行问题且不污染现有草稿', async ({ page }) => {
  await seedAdmin(page);

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;

    if (payload?.query?.includes('query StudentEvaluationCommentWorkspace')) {
      await route.fulfill({
        body: JSON.stringify({
          data: { studentEvaluationCommentWorkspace: buildWorkspace('原始正式评语。') },
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fallback();
  });
  await page.route('**/student-evaluation-comments/material-imports', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        data: buildMaterialImportResult({
          blockingErrors: [
            {
              code: 'STUDENT_NOT_IN_SCOPE',
              message: '材料中的学生无法在当前班级范围内找到',
              sourceRows: [3],
              sourceSheet: '评语',
            },
          ],
          selectedSheet: '评语',
          status: 'BLOCKED',
        }),
        requestId: 'req-blocked',
      }),
      contentType: 'application/json',
    });
  });

  await page.goto(routes.labsStudentEvaluationComment);
  const textarea = page.getByRole('textbox', { name: '张三正式评语' });
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('xlsx'),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name: '评语.xlsx',
  });

  await expect(page.getByText('材料中的学生无法在当前班级范围内找到')).toBeVisible();
  await expect(page.getByText(/工作表“评语” 第 3 行/)).toBeVisible();
  await expect(textarea).toHaveValue('原始正式评语。');
  await expect(page.getByText('全部已同步')).toBeVisible();
});

test('学生入口只读取当前账号绑定学生且不展示班级编辑面', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'student-user',
      identity: { id: '324010112', kind: 'STUDENT' },
      primaryAccessGroup: 'STUDENT',
    },
  });
  await seedAuthSession(page, {
    displayName: 'student-user',
    identity: { id: '324010112', kind: 'STUDENT' },
    primaryAccessGroup: 'STUDENT',
  });

  let variables: unknown = null;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: unknown }
      | undefined;

    if (payload?.query?.includes('query MyStudentEvaluationComments')) {
      variables = payload.variables;
      await route.fulfill({
        body: JSON.stringify({
          data: {
            myStudentEvaluationComments: {
              graduation: {
                content: '正式毕业评语。',
                source: 'MANUAL',
                updatedAt: '2026-07-16T01:02:03.000Z',
              },
              studentId: '324010112',
              terms: [
                {
                  content: '第一学期正式评语。',
                  semesterId: 202401,
                  source: 'MANUAL',
                  updatedAt: '2025-01-15T01:02:03.000Z',
                },
              ],
            },
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsStudentEvaluationComment);

  await expect(page.getByRole('tab', { name: '我的正式评语' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '班级评语编辑' })).toHaveCount(0);
  await expect(page.getByText('第一学期正式评语。')).toBeVisible();
  await expect(page.getByText('正式毕业评语。')).toBeVisible();
  expect(variables).toEqual({});
});
