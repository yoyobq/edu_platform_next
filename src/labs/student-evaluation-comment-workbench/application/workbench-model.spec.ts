// src/labs/student-evaluation-comment-workbench/application/workbench-model.spec.ts

import { describe, expect, it } from 'vitest';

import type { StudentEvaluationCommentWorkbenchStudent } from '../types';

import {
  collectStudentEvaluationCommentConductBasisIssues,
  countStudentEvaluationCommentWorkflowStatuses,
  resolvePreviousStudentEvaluationCommentTerm,
  resolveStudentEvaluationCommentConductBasisIssue,
  resolveStudentEvaluationCommentWorkflowStatus,
} from './workbench-model';

describe('student evaluation comment workbench model', () => {
  it('matches AI generation rules when checking confirmed conduct grades', () => {
    expect(
      resolveStudentEvaluationCommentConductBasisIssue({
        conflict: null,
        displayValue: '优',
        source: 'UPSTREAM_CONFIRMED',
      }),
    ).toBeNull();
    expect(
      resolveStudentEvaluationCommentConductBasisIssue({
        conflict: null,
        displayValue: '良',
        source: 'LOCAL_CORRECTION',
      }),
    ).toBeNull();
    expect(
      resolveStudentEvaluationCommentConductBasisIssue({
        conflict: null,
        displayValue: null,
        source: 'MISSING',
      }),
    ).toBe('CONDUCT_GRADE_MISSING');
    expect(
      resolveStudentEvaluationCommentConductBasisIssue({
        conflict: 'UPSTREAM_CHANGED_SINCE_CORRECTION',
        displayValue: null,
        source: 'MISSING',
      }),
    ).toBe('CONDUCT_GRADE_CONFLICT');
  });

  it('collects student-level conduct issues for generation preflight', () => {
    expect(
      collectStudentEvaluationCommentConductBasisIssues([
        {
          fields: {
            confirmedGrade: {
              conflict: null,
              displayValue: '优',
              source: 'UPSTREAM_CONFIRMED',
            },
          },
          studentId: 'ready',
        },
        {
          fields: {
            confirmedGrade: { conflict: null, displayValue: null, source: 'MISSING' },
          },
          studentId: 'missing',
        },
      ]),
    ).toEqual({ missing: 'CONDUCT_GRADE_MISSING' });
  });

  it('assigns every student to one exclusive workflow status', () => {
    const students = [
      student({ studentId: 'todo' }),
      student({ isAiDraftGenerating: true, studentId: 'generating' }),
      student({ aiDraft: draft(), studentId: 'review' }),
      student({ comment: comment(), studentId: 'completed' }),
      student({ studentId: 'issue' }),
    ];

    expect(
      countStudentEvaluationCommentWorkflowStatuses({
        issuesByStudentId: { issue: 'BASIS_MISSING' },
        now: Date.parse('2026-08-25T00:00:00.000Z'),
        students,
      }),
    ).toEqual({ ALL: 5, TODO: 1, GENERATING: 1, REVIEW: 1, COMPLETED: 1, ISSUE: 1 });
  });

  it('treats an expired draft as an actionable issue', () => {
    expect(
      resolveStudentEvaluationCommentWorkflowStatus({
        now: Date.parse('2026-08-25T00:00:00.000Z'),
        student: student({ aiDraft: draft({ expiresAt: '2026-08-24T23:59:59.999Z' }) }),
      }),
    ).toBe('ISSUE');
  });

  it('treats an imported working draft as review even when a formal comment exists', () => {
    const completedStudent = student({ comment: comment(), studentId: 'updated-from-excel' });

    expect(
      resolveStudentEvaluationCommentWorkflowStatus({
        hasWorkingDraft: true,
        student: completedStudent,
      }),
    ).toBe('REVIEW');
    expect(
      countStudentEvaluationCommentWorkflowStatuses({
        issuesByStudentId: {},
        students: [completedStudent],
        workingDraftStudentIds: new Set(['updated-from-excel']),
      }),
    ).toEqual({ ALL: 1, TODO: 0, GENERATING: 0, REVIEW: 1, COMPLETED: 0, ISSUE: 0 });
  });

  it('uses the immediately preceding class term and leaves the first term without a reference', () => {
    const terms = [
      term({ label: '第一学期', semesterId: 1, sequence: 1 }),
      term({ label: '第二学期', semesterId: 2, sequence: 2 }),
      term({ label: '第三学期', semesterId: 3, sequence: 3 }),
    ];

    expect(resolvePreviousStudentEvaluationCommentTerm(terms, terms[0] ?? null)).toBeNull();
    expect(resolvePreviousStudentEvaluationCommentTerm(terms, terms[2] ?? null)).toEqual(terms[1]);
  });
});

function term(
  overrides: Partial<import('../types').StudentEvaluationCommentTermOption> = {},
): import('../types').StudentEvaluationCommentTermOption {
  return {
    isCurrent: false,
    label: '学期',
    schoolYear: 2025,
    semesterId: 1,
    sequence: 1,
    termNumber: 1,
    ...overrides,
  };
}

function student(
  overrides: Partial<StudentEvaluationCommentWorkbenchStudent> = {},
): StudentEvaluationCommentWorkbenchStudent {
  return {
    aiDraft: null,
    comment: null,
    isAiDraftGenerating: false,
    studentId: 'student-1',
    studentName: '张三',
    studentStatus: 'ENROLLED',
    ...overrides,
  };
}

function draft(
  overrides: Partial<NonNullable<StudentEvaluationCommentWorkbenchStudent['aiDraft']>> = {},
) {
  return {
    content: 'AI 草稿',
    draftId: '1',
    expiresAt: '2026-08-26T00:00:00.000Z',
    revision: { payloadHash: 'a'.repeat(64), payloadVersion: 1 },
    updatedAt: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

function comment(): NonNullable<StudentEvaluationCommentWorkbenchStudent['comment']> {
  return {
    content: '正式评语',
    revision: { payloadHash: 'b'.repeat(64), payloadVersion: 1 },
    source: 'MANUAL',
    updatedAt: '2026-08-25T00:00:00.000Z',
  };
}
