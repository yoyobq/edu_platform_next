// src/labs/student-evaluation-comment-workbench/application/workbench-model.ts

import type {
  StudentEvaluationCommentAiScenario,
  StudentEvaluationCommentClassOption,
  StudentEvaluationCommentConductGradeField,
  StudentEvaluationCommentTermOption,
  StudentEvaluationCommentWorkbenchStudent,
} from '../types';

export type StudentEvaluationCommentWorkflowStatus =
  | 'ALL'
  | 'TODO'
  | 'GENERATING'
  | 'REVIEW'
  | 'COMPLETED'
  | 'ISSUE';

export const STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS = 1000;

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

export type StudentEvaluationCommentConductBasisIssue =
  | 'CONDUCT_GRADE_MISSING'
  | 'CONDUCT_GRADE_CONFLICT';

export function resolveStudentEvaluationCommentConductBasisIssue(
  field: StudentEvaluationCommentConductGradeField,
): StudentEvaluationCommentConductBasisIssue | null {
  if (field.conflict === 'UPSTREAM_CHANGED_SINCE_CORRECTION') {
    return 'CONDUCT_GRADE_CONFLICT';
  }
  if (!field.displayValue?.trim()) return 'CONDUCT_GRADE_MISSING';
  if (field.source === 'UPSTREAM_CONFIRMED') return null;
  if (field.source === 'LOCAL_CORRECTION' && field.conflict === null) return null;
  return 'CONDUCT_GRADE_MISSING';
}

export function collectStudentEvaluationCommentConductBasisIssues(
  students: ReadonlyArray<{
    readonly fields: { readonly confirmedGrade: StudentEvaluationCommentConductGradeField };
    readonly studentId: string;
  }>,
) {
  const issues: Record<string, StudentEvaluationCommentConductBasisIssue> = {};

  students.forEach((student) => {
    const issue = resolveStudentEvaluationCommentConductBasisIssue(student.fields.confirmedGrade);
    if (issue) issues[student.studentId] = issue;
  });

  return issues;
}

export function resolveStudentEvaluationCommentWorkflowStatus(input: {
  hasWorkingDraft?: boolean;
  issueCode?: string | null;
  now?: number;
  student: StudentEvaluationCommentWorkbenchStudent;
}): Exclude<StudentEvaluationCommentWorkflowStatus, 'ALL'> {
  if (input.hasWorkingDraft) return 'REVIEW';
  if (input.student.comment) return 'COMPLETED';
  if (input.issueCode) return 'ISSUE';
  if (input.student.aiDraft) {
    const expiresAt = new Date(input.student.aiDraft.expiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt <= (input.now ?? Date.now())) return 'ISSUE';
    return 'REVIEW';
  }
  if (input.student.isAiDraftGenerating) return 'GENERATING';
  return 'TODO';
}

export function countStudentEvaluationCommentWorkflowStatuses(input: {
  issuesByStudentId: Readonly<Record<string, string>>;
  now?: number;
  students: readonly StudentEvaluationCommentWorkbenchStudent[];
  workingDraftStudentIds?: ReadonlySet<string>;
}) {
  const counts = {
    ALL: input.students.length,
    TODO: 0,
    GENERATING: 0,
    REVIEW: 0,
    COMPLETED: 0,
    ISSUE: 0,
  };

  input.students.forEach((student) => {
    const status = resolveStudentEvaluationCommentWorkflowStatus({
      hasWorkingDraft: input.workingDraftStudentIds?.has(student.studentId),
      issueCode: input.issuesByStudentId[student.studentId],
      now: input.now,
      student,
    });
    counts[status] += 1;
  });

  return counts;
}

export function normalizeStudentEvaluationCommentContent(content: string) {
  return content.replace(/\r\n?/g, '\n').trim();
}

export function countStudentEvaluationCommentCodePoints(content: string) {
  return Array.from(normalizeStudentEvaluationCommentContent(content)).length;
}

export function resolvePreviousStudentEvaluationCommentTerm(
  terms: readonly StudentEvaluationCommentTermOption[],
  selectedTerm: StudentEvaluationCommentTermOption | null,
) {
  if (!selectedTerm || selectedTerm.sequence <= 1) return null;

  return terms.find((term) => term.sequence === selectedTerm.sequence - 1) ?? null;
}
