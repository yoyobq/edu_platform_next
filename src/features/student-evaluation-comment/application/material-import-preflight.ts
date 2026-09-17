// src/features/student-evaluation-comment/application/material-import-preflight.ts

import type {
  StudentEvaluationCommentMaterialPreviewRow,
  StudentEvaluationCommentRevision,
  StudentEvaluationCommentWorkbenchStudent,
} from '../types';

function revisionsEqual(
  left: StudentEvaluationCommentRevision | null,
  right: StudentEvaluationCommentRevision | null,
) {
  if (left === null || right === null) return left === right;

  return left.payloadHash === right.payloadHash && left.payloadVersion === right.payloadVersion;
}

export function assertMaterialPreviewMatchesWorkspace(input: {
  previewRows: readonly StudentEvaluationCommentMaterialPreviewRow[];
  students: readonly StudentEvaluationCommentWorkbenchStudent[];
}) {
  const studentsById = new Map(input.students.map((student) => [student.studentId, student]));
  const previewStudentIds = new Set<string>();

  input.previewRows.forEach((row) => {
    if (!studentsById.has(row.studentId)) {
      throw new Error('导入结果包含当前班级之外的学生，请刷新后重试。');
    }
    if (previewStudentIds.has(row.studentId)) {
      throw new Error('导入结果包含重复学生，请重新上传。');
    }

    const workspaceRevision = studentsById.get(row.studentId)?.comment?.revision ?? null;
    if (!revisionsEqual(workspaceRevision, row.expectedRevision)) {
      throw new Error('正式评语已发生变化，请重新加载工作台后重新上传 Excel。');
    }
    previewStudentIds.add(row.studentId);
  });
}
