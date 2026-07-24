// src/labs/student-evaluation-comment/application/material-import-draft.ts

import type {
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentMaterialPreviewRow,
  StudentEvaluationCommentRevision,
} from '../types';

import { resolveStudentEvaluationCommentDraftState } from './comment-draft';

export type StudentEvaluationCommentMaterialDraftMergeResult = {
  drafts: Record<string, string>;
  expectedRevisionOverrides: Record<string, StudentEvaluationCommentRevision | null>;
  importedStudentIds: string[];
  preservedDirtyStudentIds: string[];
};

function revisionsEqual(
  left: StudentEvaluationCommentRevision | null,
  right: StudentEvaluationCommentRevision | null,
) {
  if (left === null || right === null) return left === right;

  return left.payloadHash === right.payloadHash && left.payloadVersion === right.payloadVersion;
}

export function mergeStudentEvaluationCommentMaterialPreview(input: {
  drafts: Readonly<Record<string, string>>;
  expectedRevisionOverrides: Readonly<Record<string, StudentEvaluationCommentRevision | null>>;
  previewRows: readonly StudentEvaluationCommentMaterialPreviewRow[];
  students: readonly StudentEvaluationCommentClassScopeStudent[];
}): StudentEvaluationCommentMaterialDraftMergeResult {
  const studentsById = new Map(input.students.map((student) => [student.studentId, student]));
  const previewStudentIds = new Set<string>();

  input.previewRows.forEach((row) => {
    if (!studentsById.has(row.studentId)) {
      throw new Error('班级名单已变化，请重新加载工作台后重新上传 Excel。');
    }
    if (previewStudentIds.has(row.studentId)) {
      throw new Error('Excel 导入结果包含重复学生，请重新上传。');
    }

    const student = studentsById.get(row.studentId);
    const workspaceRevision = student?.comment?.revision ?? null;

    if (!revisionsEqual(workspaceRevision, row.expectedRevision)) {
      throw new Error('正式评语已发生变化，请重新加载工作台后重新上传 Excel。');
    }
    previewStudentIds.add(row.studentId);
  });

  const drafts = { ...input.drafts };
  const expectedRevisionOverrides = { ...input.expectedRevisionOverrides };
  const importedStudentIds: string[] = [];
  const preservedDirtyStudentIds: string[] = [];

  input.previewRows.forEach((row) => {
    const student = studentsById.get(row.studentId);

    if (!student) {
      return;
    }

    const draftState = resolveStudentEvaluationCommentDraftState(
      student,
      drafts[student.studentId] ?? student.comment?.content ?? '',
    );

    if (draftState.isDirty) {
      preservedDirtyStudentIds.push(student.studentId);
      return;
    }

    drafts[student.studentId] = row.content;
    expectedRevisionOverrides[student.studentId] = row.expectedRevision;
    importedStudentIds.push(student.studentId);
  });

  return {
    drafts,
    expectedRevisionOverrides,
    importedStudentIds,
    preservedDirtyStudentIds,
  };
}
