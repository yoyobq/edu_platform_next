// src/labs/student-evaluation-comment/application/comment-draft.ts

import type {
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentRevision,
  StudentEvaluationCommentWriteItem,
} from '../types';

export const STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS = 1000;
export const STUDENT_EVALUATION_COMMENT_MAX_BATCH_SIZE = 500;

export type StudentEvaluationCommentDraftState = {
  action: 'UPSERT' | 'CLEAR' | null;
  codePointLength: number;
  isDirty: boolean;
  isInvalid: boolean;
  normalizedContent: string;
};

export function normalizeStudentEvaluationCommentContent(content: string) {
  return content.replace(/\r\n?/g, '\n').trim();
}

export function countStudentEvaluationCommentCodePoints(content: string) {
  return Array.from(normalizeStudentEvaluationCommentContent(content)).length;
}

export function resolveStudentEvaluationCommentDraftState(
  student: StudentEvaluationCommentClassScopeStudent,
  draftContent: string,
): StudentEvaluationCommentDraftState {
  const normalizedContent = normalizeStudentEvaluationCommentContent(draftContent);
  const originalContent = normalizeStudentEvaluationCommentContent(student.comment?.content ?? '');
  const codePointLength = Array.from(normalizedContent).length;
  const isDirty = normalizedContent !== originalContent;
  const isInvalid = codePointLength > STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS;

  return {
    action: !isDirty ? null : normalizedContent ? 'UPSERT' : 'CLEAR',
    codePointLength,
    isDirty,
    isInvalid,
    normalizedContent,
  };
}

export function buildStudentEvaluationCommentWriteItems(
  students: readonly StudentEvaluationCommentClassScopeStudent[],
  drafts: Readonly<Record<string, string>>,
  expectedRevisionOverrides: Readonly<Record<string, StudentEvaluationCommentRevision | null>> = {},
): StudentEvaluationCommentWriteItem[] {
  const items = students.flatMap<StudentEvaluationCommentWriteItem>((student) => {
    const state = resolveStudentEvaluationCommentDraftState(
      student,
      drafts[student.studentId] ?? student.comment?.content ?? '',
    );

    if (!state.isDirty) {
      return [];
    }

    if (state.isInvalid) {
      throw new Error(`${student.studentName}的评语超过 1000 个字符。`);
    }

    const hasExpectedRevisionOverride = Object.prototype.hasOwnProperty.call(
      expectedRevisionOverrides,
      student.studentId,
    );
    const expectedRevision = hasExpectedRevisionOverride
      ? (expectedRevisionOverrides[student.studentId] ?? null)
      : (student.comment?.revision ?? null);

    if (state.action === 'CLEAR') {
      return [
        {
          action: 'CLEAR',
          expectedRevision,
          studentId: student.studentId,
        },
      ];
    }

    return [
      {
        action: 'UPSERT',
        content: state.normalizedContent,
        expectedRevision,
        studentId: student.studentId,
      },
    ];
  });

  if (items.length > STUDENT_EVALUATION_COMMENT_MAX_BATCH_SIZE) {
    throw new Error('一次最多保存 500 名学生的评语。');
  }

  return items;
}
