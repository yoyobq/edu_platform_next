// src/labs/student-evaluation-comment/application/comment-draft.spec.ts

import { describe, expect, it } from 'vitest';

import type { StudentEvaluationCommentClassScopeStudent } from '../types';

import {
  buildStudentEvaluationCommentWriteItems,
  countStudentEvaluationCommentCodePoints,
  normalizeStudentEvaluationCommentContent,
  resolveStudentEvaluationCommentDraftState,
} from './comment-draft';

const REVISION = {
  payloadHash: 'a'.repeat(64),
  payloadVersion: 1,
};

function createStudent(
  overrides: Partial<StudentEvaluationCommentClassScopeStudent> = {},
): StudentEvaluationCommentClassScopeStudent {
  return {
    aiDraft: null,
    comment: null,
    isAiDraftGenerating: false,
    studentId: '324010112',
    studentName: '张三',
    studentStatus: 'ENROLLED',
    ...overrides,
  };
}

describe('student evaluation comment drafts', () => {
  it('normalizes line endings and surrounding whitespace before comparison', () => {
    expect(normalizeStudentEvaluationCommentContent('  第一行\r\n第二行\r  ')).toBe(
      '第一行\n第二行',
    );
  });

  it('counts Unicode code points instead of UTF-16 code units', () => {
    expect(countStudentEvaluationCommentCodePoints('好😀')).toBe(2);
  });

  it('builds a create item with normalized content and null revision', () => {
    const student = createStudent();

    expect(
      buildStudentEvaluationCommentWriteItems([student], {
        [student.studentId]: '  表现良好。\r\n继续努力。 ',
      }),
    ).toEqual([
      {
        action: 'UPSERT',
        content: '表现良好。\n继续努力。',
        expectedRevision: null,
        studentId: student.studentId,
      },
    ]);
  });

  it('keeps the original revision when updating an existing comment', () => {
    const student = createStudent({
      comment: {
        content: '原评语',
        revision: REVISION,
        source: 'MANUAL',
        updatedAt: '2026-07-16T01:02:03.000Z',
      },
    });

    expect(
      buildStudentEvaluationCommentWriteItems([student], {
        [student.studentId]: '更新后的评语',
      }),
    ).toEqual([
      {
        action: 'UPSERT',
        content: '更新后的评语',
        expectedRevision: REVISION,
        studentId: student.studentId,
      },
    ]);
  });

  it('uses a material import revision override when saving an imported draft', () => {
    const student = createStudent({
      comment: {
        content: '原评语',
        revision: REVISION,
        source: 'MANUAL',
        updatedAt: '2026-07-16T01:02:03.000Z',
      },
    });
    const importedRevision = { payloadHash: 'b'.repeat(64), payloadVersion: 2 };

    expect(
      buildStudentEvaluationCommentWriteItems(
        [student],
        { [student.studentId]: 'Excel 评语' },
        { [student.studentId]: importedRevision },
      ),
    ).toEqual([
      {
        action: 'UPSERT',
        content: 'Excel 评语',
        expectedRevision: importedRevision,
        studentId: student.studentId,
      },
    ]);
  });

  it('builds CLEAR only for an existing comment that becomes empty', () => {
    const existing = createStudent({
      comment: {
        content: '原评语',
        revision: REVISION,
        source: 'MANUAL',
        updatedAt: '2026-07-16T01:02:03.000Z',
      },
    });
    const empty = createStudent({ studentId: '324010113', studentName: '李四' });

    expect(
      buildStudentEvaluationCommentWriteItems([existing, empty], {
        [existing.studentId]: '  ',
        [empty.studentId]: '\r\n',
      }),
    ).toEqual([
      {
        action: 'CLEAR',
        expectedRevision: REVISION,
        studentId: existing.studentId,
      },
    ]);
  });

  it('does not mark equivalent canonical content as dirty', () => {
    const student = createStudent({
      comment: {
        content: '第一行\n第二行',
        revision: REVISION,
        source: 'MANUAL',
        updatedAt: '2026-07-16T01:02:03.000Z',
      },
    });

    expect(resolveStudentEvaluationCommentDraftState(student, ' 第一行\r\n第二行 ')).toMatchObject({
      action: null,
      isDirty: false,
      isInvalid: false,
    });
    expect(
      buildStudentEvaluationCommentWriteItems([student], {
        [student.studentId]: ' 第一行\r\n第二行 ',
      }),
    ).toEqual([]);
  });

  it('rejects content beyond 1000 Unicode code points', () => {
    const student = createStudent();
    const content = '😀'.repeat(1001);

    expect(resolveStudentEvaluationCommentDraftState(student, content)).toMatchObject({
      codePointLength: 1001,
      isInvalid: true,
    });
    expect(() =>
      buildStudentEvaluationCommentWriteItems([student], {
        [student.studentId]: content,
      }),
    ).toThrow('张三的评语超过 1000 个字符。');
  });
});
