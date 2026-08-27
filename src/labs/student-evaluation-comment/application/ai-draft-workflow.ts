// src/labs/student-evaluation-comment/application/ai-draft-workflow.ts

import type {
  GenerateStudentEvaluationCommentAiDraftsResult,
  StudentEvaluationCommentAiDraft,
  StudentEvaluationCommentAiGenerationDisposition,
  StudentEvaluationCommentAiGenerationOptions,
  StudentEvaluationCommentAiScenario,
  StudentEvaluationCommentClassOption,
  StudentEvaluationCommentClassScopeStudent,
  StudentEvaluationCommentRevision,
  StudentEvaluationCommentTermOption,
  StudentEvaluationCommentWorkspace,
} from '../types';

import {
  countStudentEvaluationCommentCodePoints,
  normalizeStudentEvaluationCommentContent,
  STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS,
} from './comment-draft';

export const DEFAULT_STUDENT_EVALUATION_COMMENT_AI_OPTIONS = {
  address: 'THIRD_PERSON',
  length: 'CHARS_120_180',
  tone: 'OBJECTIVE_BALANCED',
} as const satisfies StudentEvaluationCommentAiGenerationOptions;

export function resolveStudentEvaluationCommentAiScenario(input: {
  selectedClass: StudentEvaluationCommentClassOption | null;
  selectedTerm: StudentEvaluationCommentTermOption | null;
}): StudentEvaluationCommentAiScenario {
  const trainingYears = input.selectedClass?.trainingYears;
  const isFinalTerm =
    typeof trainingYears === 'number' &&
    Number.isInteger(trainingYears) &&
    trainingYears > 0 &&
    input.selectedTerm?.sequence === trainingYears * 2;

  return isFinalTerm ? 'OFF_CAMPUS_INTERNSHIP' : 'ACADEMIC_TERM';
}

export type StudentEvaluationCommentAiDraftEdit = {
  content: string;
  draftId: string;
  expiresAt: string;
  isDirty: boolean;
  isStale: boolean;
  revision: StudentEvaluationCommentRevision;
  serverContent: string;
  studentId: string;
  updatedAt: string;
};

export type StudentEvaluationCommentAiDraftWorkflowState = {
  edits: Record<string, StudentEvaluationCommentAiDraftEdit>;
  generationDispositions: Record<string, StudentEvaluationCommentAiGenerationDisposition>;
  noDraftStudentIds: string[];
  options: StudentEvaluationCommentAiGenerationOptions;
  pendingAutoSelectStudentIds: string[];
  scopeKey: string;
  selectedDraftIds: string[];
  styleExampleStudentIds: string[];
  targetStudentIds: string[];
};

export type StudentEvaluationCommentAiDraftWorkflowAction =
  | {
      students: readonly StudentEvaluationCommentClassScopeStudent[];
      scopeKey: string;
      type: 'RESET_SCOPE';
    }
  | { studentIds: readonly string[]; type: 'SET_TARGET_STUDENTS' }
  | { studentIds: readonly string[]; type: 'SET_STYLE_EXAMPLES' }
  | {
      options: Partial<StudentEvaluationCommentAiGenerationOptions>;
      type: 'SET_OPTIONS';
    }
  | { result: GenerateStudentEvaluationCommentAiDraftsResult; type: 'GENERATION_SETTLED' }
  | {
      students: readonly StudentEvaluationCommentClassScopeStudent[];
      type: 'WORKSPACE_MERGED';
    }
  | { content: string; draftId: string; type: 'EDIT_DRAFT' }
  | {
      draft: StudentEvaluationCommentAiDraft;
      studentId: string;
      type: 'RESET_DRAFT_EDIT' | 'DRAFT_SAVED';
    }
  | { draftIds: readonly string[]; type: 'SET_SELECTED_DRAFTS' }
  | { draftIds: readonly string[]; type: 'DRAFTS_REMOVED' };

export function createStudentEvaluationCommentAiDraftWorkflowState(input: {
  scopeKey: string;
  students: readonly StudentEvaluationCommentClassScopeStudent[];
}): StudentEvaluationCommentAiDraftWorkflowState {
  return {
    edits: buildServerDraftEdits(input.students),
    generationDispositions: {},
    noDraftStudentIds: [],
    options: { ...DEFAULT_STUDENT_EVALUATION_COMMENT_AI_OPTIONS },
    pendingAutoSelectStudentIds: [],
    scopeKey: input.scopeKey,
    selectedDraftIds: [],
    styleExampleStudentIds: [],
    targetStudentIds: [],
  };
}

export function studentEvaluationCommentAiDraftWorkflowReducer(
  state: StudentEvaluationCommentAiDraftWorkflowState,
  action: StudentEvaluationCommentAiDraftWorkflowAction,
): StudentEvaluationCommentAiDraftWorkflowState {
  switch (action.type) {
    case 'RESET_SCOPE':
      return createStudentEvaluationCommentAiDraftWorkflowState(action);
    case 'SET_TARGET_STUDENTS':
      return { ...state, targetStudentIds: uniqueStrings(action.studentIds) };
    case 'SET_STYLE_EXAMPLES':
      return { ...state, styleExampleStudentIds: uniqueStrings(action.studentIds).slice(0, 5) };
    case 'SET_OPTIONS':
      return { ...state, options: { ...state.options, ...action.options } };
    case 'GENERATION_SETTLED':
      return settleGeneration(state, action.result);
    case 'WORKSPACE_MERGED':
      return mergeWorkspaceStudents(state, action.students);
    case 'EDIT_DRAFT': {
      const current = state.edits[action.draftId];
      if (!current) return state;

      return {
        ...state,
        edits: {
          ...state.edits,
          [action.draftId]: {
            ...current,
            content: action.content,
            isDirty:
              normalizeStudentEvaluationCommentContent(action.content) !==
              normalizeStudentEvaluationCommentContent(current.serverContent),
          },
        },
      };
    }
    case 'RESET_DRAFT_EDIT':
    case 'DRAFT_SAVED':
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.draft.draftId]: toDraftEdit(action.studentId, action.draft),
        },
      };
    case 'SET_SELECTED_DRAFTS':
      return { ...state, selectedDraftIds: uniqueStrings(action.draftIds) };
    case 'DRAFTS_REMOVED':
      return removeDrafts(state, action.draftIds);
  }
}

export function resolveStudentEvaluationCommentAiGenerationBlockingReason(input: {
  generateAllowed: boolean;
  hasManualDraft: boolean;
  student: StudentEvaluationCommentClassScopeStudent;
}): string | null {
  if (!input.generateAllowed) return '当前范围暂不可生成';
  if (input.student.comment) return '已有正式评语';
  if (input.student.aiDraft) return '已有 AI 草稿';
  if (input.student.isAiDraftGenerating) return '正在生成';
  if (input.hasManualDraft) return '存在未保存的人工修改';
  return null;
}

export function resolveStudentEvaluationCommentAiDispositionLabel(
  disposition: StudentEvaluationCommentAiGenerationDisposition,
): string {
  const labels: Record<StudentEvaluationCommentAiGenerationDisposition, string> = {
    ACCEPTED: '已受理',
    ALREADY_GENERATING: '正在生成',
    BASIS_MISSING: '缺少有效评语依据',
    DRAFT_EXISTS: '已有 AI 草稿',
    FORMAL_COMMENT_EXISTS: '已有正式评语',
  };

  return labels[disposition];
}

export function resolveStudentEvaluationCommentAiDraftValidation(
  edit: StudentEvaluationCommentAiDraftEdit,
) {
  const normalizedContent = normalizeStudentEvaluationCommentContent(edit.content);
  const codePointLength = countStudentEvaluationCommentCodePoints(edit.content);

  return {
    codePointLength,
    isInvalid:
      normalizedContent.length === 0 ||
      codePointLength > STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS,
    normalizedContent,
  };
}

export function mergeStudentEvaluationCommentWorkspaceForAi(input: {
  current: StudentEvaluationCommentWorkspace | null;
  next: StudentEvaluationCommentWorkspace;
  preserveFormalCommentStudentIds: ReadonlySet<string>;
}): StudentEvaluationCommentWorkspace {
  const currentView = input.current?.view;
  const nextView = input.next.view;
  if (!currentView || !nextView || currentView.scope.scopeKey !== nextView.scope.scopeKey) {
    return input.next;
  }

  const currentStudents = new Map(
    currentView.students.map((student) => [student.studentId, student] as const),
  );

  return {
    ...input.next,
    view: {
      ...nextView,
      students: nextView.students.map((student) => {
        if (!input.preserveFormalCommentStudentIds.has(student.studentId)) return student;
        const current = currentStudents.get(student.studentId);
        return current ? { ...student, comment: current.comment } : student;
      }),
    },
  };
}

function settleGeneration(
  state: StudentEvaluationCommentAiDraftWorkflowState,
  result: GenerateStudentEvaluationCommentAiDraftsResult,
): StudentEvaluationCommentAiDraftWorkflowState {
  const generationDispositions = { ...state.generationDispositions };
  const acceptedStudentIds: string[] = [];

  result.items.forEach((item) => {
    generationDispositions[item.studentId] = item.disposition;
    if (item.disposition === 'ACCEPTED') acceptedStudentIds.push(item.studentId);
  });

  return {
    ...state,
    generationDispositions,
    noDraftStudentIds: state.noDraftStudentIds.filter(
      (studentId) => !acceptedStudentIds.includes(studentId),
    ),
    pendingAutoSelectStudentIds: uniqueStrings([
      ...state.pendingAutoSelectStudentIds,
      ...acceptedStudentIds,
    ]),
    targetStudentIds: [],
  };
}

function mergeWorkspaceStudents(
  state: StudentEvaluationCommentAiDraftWorkflowState,
  students: readonly StudentEvaluationCommentClassScopeStudent[],
): StudentEvaluationCommentAiDraftWorkflowState {
  const edits: Record<string, StudentEvaluationCommentAiDraftEdit> = {};
  const serverDraftIds = new Set<string>();
  const selectedDraftIds = new Set(state.selectedDraftIds);
  const pendingAutoSelectStudentIds = new Set(state.pendingAutoSelectStudentIds);
  const noDraftStudentIds = new Set(state.noDraftStudentIds);
  const existingEditsByStudentId = new Map(
    Object.values(state.edits).map((edit) => [edit.studentId, edit] as const),
  );

  students.forEach((student) => {
    const draft = student.aiDraft;
    if (draft) {
      serverDraftIds.add(draft.draftId);
      const existing = state.edits[draft.draftId];
      const revisionChanged =
        existing !== undefined && !revisionsEqual(existing.revision, draft.revision);
      edits[draft.draftId] = existing?.isDirty
        ? { ...existing, isStale: existing.isStale || revisionChanged }
        : toDraftEdit(student.studentId, draft);
      noDraftStudentIds.delete(student.studentId);

      if (pendingAutoSelectStudentIds.delete(student.studentId)) {
        selectedDraftIds.add(draft.draftId);
      }
      return;
    }

    const existing = existingEditsByStudentId.get(student.studentId);
    if (existing?.isDirty) {
      edits[existing.draftId] = { ...existing, isStale: true };
    }
    if (!student.isAiDraftGenerating && pendingAutoSelectStudentIds.delete(student.studentId)) {
      noDraftStudentIds.add(student.studentId);
    }
    if (student.isAiDraftGenerating) noDraftStudentIds.delete(student.studentId);
  });

  return {
    ...state,
    edits,
    noDraftStudentIds: [...noDraftStudentIds],
    pendingAutoSelectStudentIds: [...pendingAutoSelectStudentIds],
    selectedDraftIds: [...selectedDraftIds].filter((draftId) => serverDraftIds.has(draftId)),
    styleExampleStudentIds: state.styleExampleStudentIds.filter((studentId) =>
      students.some((student) => student.studentId === studentId && Boolean(student.comment)),
    ),
  };
}

function removeDrafts(
  state: StudentEvaluationCommentAiDraftWorkflowState,
  draftIds: readonly string[],
): StudentEvaluationCommentAiDraftWorkflowState {
  const removed = new Set(draftIds);
  return {
    ...state,
    edits: Object.fromEntries(
      Object.entries(state.edits).filter(([draftId]) => !removed.has(draftId)),
    ),
    selectedDraftIds: state.selectedDraftIds.filter((draftId) => !removed.has(draftId)),
  };
}

function buildServerDraftEdits(
  students: readonly StudentEvaluationCommentClassScopeStudent[],
): Record<string, StudentEvaluationCommentAiDraftEdit> {
  return Object.fromEntries(
    students.flatMap((student) =>
      student.aiDraft
        ? [[student.aiDraft.draftId, toDraftEdit(student.studentId, student.aiDraft)]]
        : [],
    ),
  );
}

function toDraftEdit(
  studentId: string,
  draft: StudentEvaluationCommentAiDraft,
): StudentEvaluationCommentAiDraftEdit {
  return {
    content: draft.content,
    draftId: draft.draftId,
    expiresAt: draft.expiresAt,
    isDirty: false,
    isStale: false,
    revision: { ...draft.revision },
    serverContent: draft.content,
    studentId,
    updatedAt: draft.updatedAt,
  };
}

function revisionsEqual(
  left: StudentEvaluationCommentRevision,
  right: StudentEvaluationCommentRevision,
) {
  return left.payloadHash === right.payloadHash && left.payloadVersion === right.payloadVersion;
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)];
}
