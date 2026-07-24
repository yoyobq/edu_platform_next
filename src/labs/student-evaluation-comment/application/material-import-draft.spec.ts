// src/labs/student-evaluation-comment/application/material-import-draft.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentMaterialPreviewRow,
  StudentEvaluationCommentRevision,
} from '../types';

import { mergeStudentEvaluationCommentMaterialPreview } from './material-import-draft';

const REVISION = { payloadHash: 'a'.repeat(64), payloadVersion: 1 };

function createStudent(
  studentId: string,
  studentName: string,
  content: string | null = null,
): StudentEvaluationCommentClassScopeStudent {
  return {
    comment: content
      ? { content, revision: REVISION, source: 'MANUAL', updatedAt: '2026-07-22T00:00:00Z' }
      : null,
    studentId,
    studentName,
    studentStatus: 'ENROLLED',
  };
}

function createPreviewRow(
  studentId: string,
  studentName: string,
  content: string,
  expectedRevision: StudentEvaluationCommentRevision | null = null,
): StudentEvaluationCommentMaterialPreviewRow {
  return {
    content,
    expectedRevision,
    matchedBy: 'UNIQUE_NAME',
    proposedAction: expectedRevision ? 'UPDATE' : 'CREATE',
    sourceRow: 1,
    sourceSheet: '评语',
    studentId,
    studentName,
  };
}

describe('student evaluation comment material draft merge', () => {
  it('prefills clean rows and keeps the import revisions', () => {
    const students = [createStudent('s-1', '张三'), createStudent('s-2', '李四', '旧评语')];

    expect(
      mergeStudentEvaluationCommentMaterialPreview({
        drafts: { 's-1': '', 's-2': '旧评语' },
        expectedRevisionOverrides: {},
        previewRows: [
          createPreviewRow('s-1', '张三', '新建评语'),
          createPreviewRow('s-2', '李四', '更新评语', REVISION),
        ],
        students,
      }),
    ).toEqual({
      drafts: { 's-1': '新建评语', 's-2': '更新评语' },
      expectedRevisionOverrides: { 's-1': null, 's-2': REVISION },
      importedStudentIds: ['s-1', 's-2'],
      preservedDirtyStudentIds: [],
    });
  });

  it('does not overwrite a manually edited draft', () => {
    const student = createStudent('s-1', '张三', '旧评语');

    expect(
      mergeStudentEvaluationCommentMaterialPreview({
        drafts: { 's-1': '手工草稿' },
        expectedRevisionOverrides: {},
        previewRows: [createPreviewRow('s-1', '张三', 'Excel 评语', REVISION)],
        students: [student],
      }),
    ).toMatchObject({
      drafts: { 's-1': '手工草稿' },
      importedStudentIds: [],
      preservedDirtyStudentIds: ['s-1'],
    });
  });

  it('rejects preview students outside the loaded workspace', () => {
    expect(() =>
      mergeStudentEvaluationCommentMaterialPreview({
        drafts: {},
        expectedRevisionOverrides: {},
        previewRows: [createPreviewRow('s-2', '李四', 'Excel 评语')],
        students: [createStudent('s-1', '张三')],
      }),
    ).toThrow('班级名单已变化');
  });

  it('rejects a preview built from a newer workspace revision', () => {
    expect(() =>
      mergeStudentEvaluationCommentMaterialPreview({
        drafts: { 's-1': '旧评语' },
        expectedRevisionOverrides: {},
        previewRows: [
          createPreviewRow('s-1', '张三', 'Excel 评语', {
            payloadHash: 'b'.repeat(64),
            payloadVersion: 2,
          }),
        ],
        students: [createStudent('s-1', '张三', '旧评语')],
      }),
    ).toThrow('正式评语已发生变化');
  });
});
