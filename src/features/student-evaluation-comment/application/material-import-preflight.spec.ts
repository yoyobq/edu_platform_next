// src/features/student-evaluation-comment/application/material-import-preflight.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  StudentEvaluationCommentMaterialPreviewRow,
  StudentEvaluationCommentWorkbenchStudent,
} from '../types';

import { assertMaterialPreviewMatchesWorkspace } from './material-import-preflight';

const REVISION = { payloadHash: 'a'.repeat(64), payloadVersion: 1 };

function student(overrides: Partial<StudentEvaluationCommentWorkbenchStudent> = {}) {
  return {
    aiDraft: null,
    aiGeneration: {
      generationVersion: null,
      reasonCode: null,
      retryAllowed: false,
      status: 'IDLE' as const,
      updatedAt: null,
    },
    comment: {
      content: '原评语',
      revision: REVISION,
      source: 'MANUAL' as const,
      updatedAt: '2026-09-17T00:00:00.000Z',
    },
    isAiDraftGenerating: false,
    studentId: 'student-1',
    studentName: '张三',
    studentStatus: 'ENROLLED',
    ...overrides,
  } satisfies StudentEvaluationCommentWorkbenchStudent;
}

function previewRow(
  overrides: Partial<StudentEvaluationCommentMaterialPreviewRow> = {},
): StudentEvaluationCommentMaterialPreviewRow {
  return {
    content: '导入评语',
    expectedRevision: REVISION,
    matchedBy: 'STUDENT_ID',
    proposedAction: 'UPDATE',
    sourceRow: 2,
    sourceSheet: '评语',
    studentId: 'student-1',
    studentName: '张三',
    ...overrides,
  };
}

describe('student evaluation comment material import preflight', () => {
  it('accepts preview rows that still match the loaded roster and revision', () => {
    expect(() =>
      assertMaterialPreviewMatchesWorkspace({ previewRows: [previewRow()], students: [student()] }),
    ).not.toThrow();
  });

  it('rejects a preview row outside the loaded roster', () => {
    expect(() =>
      assertMaterialPreviewMatchesWorkspace({
        previewRows: [previewRow({ studentId: 'student-2' })],
        students: [student()],
      }),
    ).toThrow('当前班级之外');
  });

  it('rejects duplicate preview rows and stale formal revisions', () => {
    expect(() =>
      assertMaterialPreviewMatchesWorkspace({
        previewRows: [previewRow(), previewRow({ sourceRow: 3 })],
        students: [student()],
      }),
    ).toThrow('重复学生');
    expect(() =>
      assertMaterialPreviewMatchesWorkspace({
        previewRows: [
          previewRow({ expectedRevision: { payloadHash: 'b'.repeat(64), payloadVersion: 2 } }),
        ],
        students: [student()],
      }),
    ).toThrow('正式评语已发生变化');
  });
});
