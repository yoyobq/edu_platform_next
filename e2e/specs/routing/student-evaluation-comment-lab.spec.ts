// e2e/specs/routing/student-evaluation-comment-lab.spec.ts

import type { Page } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const ORIGINAL_REVISION = {
  payloadHash: 'a'.repeat(64),
  payloadVersion: 1,
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

  let classScopeReadCount = 0;
  let mutationInput: Record<string, unknown> | null = null;

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: Record<string, unknown> } }
      | undefined;
    const query = payload?.query ?? '';

    if (query.includes('StudentEvaluationCommentLocalClassOptions')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            listLocalClassOptions: [
              {
                classCode: 'CS2024-01',
                className: '计算机2024级1班',
                departmentId: 'D001',
                gradeYear: 2024,
                id: '1021904',
              },
            ],
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('StudentEvaluationCommentAcademicSemesters')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicSemesters: [
              {
                id: 202501,
                isCurrent: true,
                isVisible: true,
                name: '2025-2026 第一学期',
                schoolYear: 2025,
                sortOrder: 1,
                termNumber: 1,
              },
            ],
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('query StudentEvaluationCommentClassScope')) {
      classScopeReadCount += 1;
      const result =
        classScopeReadCount === 1
          ? buildClassScope('原始正式评语。')
          : buildClassScope('更新后的正式评语。', {
              payloadHash: 'b'.repeat(64),
              payloadVersion: 1,
            });

      await route.fulfill({
        body: JSON.stringify({
          data: { studentEvaluationCommentClassScope: result },
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
  await page.getByPlaceholder('选择班级或输入 classId').fill('1021904');
  await page.getByRole('button', { name: '读取班级评语' }).click();

  const textarea = page.getByRole('textbox', { name: '张三正式评语' });
  await expect(textarea).toHaveValue('原始正式评语。');
  await textarea.fill('更新后的正式评语。');
  await expect(page.getByText('1 项未保存')).toBeVisible();
  await page.getByRole('button', { name: '保存 1' }).click();

  await expect(textarea).toHaveValue('更新后的正式评语。');
  await expect(page.getByText('全部已同步')).toBeVisible();
  expect(classScopeReadCount).toBe(2);
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

    if (query.includes('StudentEvaluationCommentLocalClassOptions')) {
      await route.fulfill({
        body: JSON.stringify({ data: { listLocalClassOptions: [] } }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('StudentEvaluationCommentAcademicSemesters')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            academicSemesters: [
              {
                id: 202501,
                isCurrent: true,
                isVisible: true,
                name: '2025-2026 第一学期',
                schoolYear: 2025,
                sortOrder: 1,
                termNumber: 1,
              },
            ],
          },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (query.includes('query StudentEvaluationCommentClassScope')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            studentEvaluationCommentClassScope: buildClassScope('原始正式评语。'),
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
  await page.getByPlaceholder('选择班级或输入 classId').fill('1021904');
  await page.getByRole('button', { name: '读取班级评语' }).click();

  const textarea = page.getByRole('textbox', { name: '张三正式评语' });
  await textarea.fill('本地冲突草稿。');
  await page.getByRole('button', { name: '保存 1' }).click();

  await expect(page.getByText('评语已被其他人修改，请重新加载当前班级数据。')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新加载并放弃草稿' })).toBeVisible();
  await expect(textarea).toHaveValue('本地冲突草稿。');
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
