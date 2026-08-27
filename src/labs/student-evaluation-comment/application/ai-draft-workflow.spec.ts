// src/labs/student-evaluation-comment/application/ai-draft-workflow.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  StudentEvaluationCommentAiDraft,
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentWorkspace,
} from '../types';

import {
  createStudentEvaluationCommentAiDraftWorkflowState,
  mergeStudentEvaluationCommentWorkspaceForAi,
  resolveStudentEvaluationCommentAiDraftValidation,
  resolveStudentEvaluationCommentAiGenerationBlockingReason,
  resolveStudentEvaluationCommentAiScenario,
  studentEvaluationCommentAiDraftWorkflowReducer,
} from './ai-draft-workflow';

const REVISION = { payloadHash: 'a'.repeat(64), payloadVersion: 1 };

describe('student evaluation comment AI draft workflow', () => {
  it('starts with explicit backend defaults and no generation targets', () => {
    const state = createStudentEvaluationCommentAiDraftWorkflowState({
      scopeKey: 'TERM:202501',
      students: [student()],
    });

    expect(state.options).toEqual({
      address: 'THIRD_PERSON',
      length: 'CHARS_120_180',
      tone: 'OBJECTIVE_BALANCED',
    });
    expect(state.targetStudentIds).toEqual([]);
    expect(state.selectedDraftIds).toEqual([]);
  });

  it('uses the internship scenario only for the configured final class term', () => {
    const selectedClass = {
      blockingReasonCode: null,
      blockingReasonMessage: null,
      catalogStatus: 'READY',
      classCode: 'class-1',
      classId: 'class-1',
      className: '测试班',
      departmentId: 'department-1',
      gradeYear: 2024,
      majorId: 'major-1',
      majorName: '测试专业',
      trainingYears: 3,
    };
    const selectedTerm = {
      isCurrent: true,
      label: '第六学期',
      schoolYear: 2026,
      semesterId: 6,
      sequence: 6,
      termNumber: 2,
    };

    expect(resolveStudentEvaluationCommentAiScenario({ selectedClass, selectedTerm })).toBe(
      'OFF_CAMPUS_INTERNSHIP',
    );
    expect(
      resolveStudentEvaluationCommentAiScenario({
        selectedClass,
        selectedTerm: { ...selectedTerm, sequence: 5 },
      }),
    ).toBe('ACADEMIC_TERM');
  });

  it('blocks targets that already have formal, draft, generating or manual content', () => {
    expect(blockingReason(student({ comment: formalComment() }))).toBe('已有正式评语');
    expect(blockingReason(student({ aiDraft: draft() }))).toBe('已有 AI 草稿');
    expect(blockingReason(student({ isAiDraftGenerating: true }))).toBe('正在生成');
    expect(blockingReason(student(), true)).toBe('存在未保存的人工修改');
  });

  it('auto-selects an accepted draft once and respects a later manual deselection', () => {
    let state = createStudentEvaluationCommentAiDraftWorkflowState({
      scopeKey: 'TERM:202501',
      students: [student()],
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      result: {
        counts: {
          accepted: 1,
          alreadyGenerating: 0,
          basisMissing: 0,
          draftExists: 0,
          formalCommentExists: 0,
          requested: 1,
        },
        items: [{ disposition: 'ACCEPTED', studentId: 's-1' }],
        status: 'ACCEPTED',
      },
      type: 'GENERATION_SETTLED',
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      students: [student({ aiDraft: draft() })],
      type: 'WORKSPACE_MERGED',
    });
    expect(state.selectedDraftIds).toEqual(['11']);

    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      draftIds: [],
      type: 'SET_SELECTED_DRAFTS',
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      students: [student({ aiDraft: draft() })],
      type: 'WORKSPACE_MERGED',
    });
    expect(state.selectedDraftIds).toEqual([]);
  });

  it('preserves dirty text and marks it stale when the server revision changes', () => {
    let state = createStudentEvaluationCommentAiDraftWorkflowState({
      scopeKey: 'TERM:202501',
      students: [student({ aiDraft: draft() })],
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      content: '老师修改后的草稿',
      draftId: '11',
      type: 'EDIT_DRAFT',
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      students: [
        student({
          aiDraft: draft({
            content: '其他人保存的草稿',
            revision: { payloadHash: 'b'.repeat(64), payloadVersion: 1 },
          }),
        }),
      ],
      type: 'WORKSPACE_MERGED',
    });

    expect(state.edits['11']).toMatchObject({
      content: '老师修改后的草稿',
      isDirty: true,
      isStale: true,
      revision: REVISION,
    });
  });

  it('marks accepted students without a draft or reservation as retryable', () => {
    let state = createStudentEvaluationCommentAiDraftWorkflowState({
      scopeKey: 'TERM:202501',
      students: [student()],
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      result: {
        counts: {
          accepted: 1,
          alreadyGenerating: 0,
          basisMissing: 0,
          draftExists: 0,
          formalCommentExists: 0,
          requested: 1,
        },
        items: [{ disposition: 'ACCEPTED', studentId: 's-1' }],
        status: 'ACCEPTED',
      },
      type: 'GENERATION_SETTLED',
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      students: [student()],
      type: 'WORKSPACE_MERGED',
    });

    expect(state.pendingAutoSelectStudentIds).toEqual([]);
    expect(state.noDraftStudentIds).toEqual(['s-1']);
  });

  it('drops style examples that no longer have a formal comment after refresh', () => {
    let state = createStudentEvaluationCommentAiDraftWorkflowState({
      scopeKey: 'TERM:202501',
      students: [student({ comment: formalComment() })],
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      studentIds: ['s-1'],
      type: 'SET_STYLE_EXAMPLES',
    });
    state = studentEvaluationCommentAiDraftWorkflowReducer(state, {
      students: [student()],
      type: 'WORKSPACE_MERGED',
    });

    expect(state.styleExampleStudentIds).toEqual([]);
  });

  it('preserves the formal revision for dirty manual rows during AI refresh', () => {
    const current = workspace([student({ comment: formalComment() })]);
    const next = workspace([
      student({
        comment: formalComment({
          content: '并发更新',
          revision: { payloadHash: 'b'.repeat(64), payloadVersion: 1 },
        }),
        isAiDraftGenerating: true,
      }),
    ]);

    const merged = mergeStudentEvaluationCommentWorkspaceForAi({
      current,
      next,
      preserveFormalCommentStudentIds: new Set(['s-1']),
    });
    expect(merged.view?.students[0]?.comment).toEqual(formalComment());
    expect(merged.view?.students[0]?.isAiDraftGenerating).toBe(true);
  });

  it('validates empty and oversized draft content with the shared policy', () => {
    const state = createStudentEvaluationCommentAiDraftWorkflowState({
      scopeKey: 'TERM:202501',
      students: [student({ aiDraft: draft() })],
    });
    const edit = state.edits['11'];
    if (!edit) throw new Error('test draft missing');

    expect(
      resolveStudentEvaluationCommentAiDraftValidation({ ...edit, content: '  ' }),
    ).toMatchObject({ isInvalid: true });
    expect(
      resolveStudentEvaluationCommentAiDraftValidation({ ...edit, content: '好'.repeat(1001) }),
    ).toMatchObject({ codePointLength: 1001, isInvalid: true });
  });
});

function blockingReason(target: StudentEvaluationCommentClassScopeStudent, hasManualDraft = false) {
  return resolveStudentEvaluationCommentAiGenerationBlockingReason({
    generateAllowed: true,
    hasManualDraft,
    student: target,
  });
}

function student(
  overrides: Partial<StudentEvaluationCommentClassScopeStudent> = {},
): StudentEvaluationCommentClassScopeStudent {
  return {
    aiDraft: null,
    comment: null,
    isAiDraftGenerating: false,
    studentId: 's-1',
    studentName: '张三',
    studentStatus: 'ENROLLED',
    ...overrides,
  };
}

function draft(overrides: Partial<StudentEvaluationCommentAiDraft> = {}) {
  return {
    content: 'AI 草稿正文',
    draftId: '11',
    expiresAt: '2026-08-27T00:00:00.000Z',
    revision: REVISION,
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  } satisfies StudentEvaluationCommentAiDraft;
}

function formalComment(
  overrides: Partial<NonNullable<StudentEvaluationCommentClassScopeStudent['comment']>> = {},
) {
  return {
    content: '正式评语',
    revision: REVISION,
    source: 'MANUAL',
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  } satisfies NonNullable<StudentEvaluationCommentClassScopeStudent['comment']>;
}

function workspace(
  students: StudentEvaluationCommentClassScopeStudent[],
): StudentEvaluationCommentWorkspace {
  return {
    actions: [
      { action: 'WRITE_COMMENTS', allowed: true, reasonCode: null, reasonMessage: null },
      { action: 'GENERATE_AI_DRAFTS', allowed: true, reasonCode: null, reasonMessage: null },
    ],
    classOptions: [],
    commentKind: 'TERM',
    selectedClass: null,
    selectedTerm: null,
    status: 'READY',
    termOptions: [],
    view: {
      classItem: { classCode: 'class-1', className: '测试班', id: 'class-1' },
      scope: { commentKind: 'TERM', scopeKey: 'TERM:202501', semesterId: 202501 },
      students,
    },
    warnings: [],
  };
}
