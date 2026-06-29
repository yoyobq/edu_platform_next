// src/labs/student-conduct-grade-governance/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  executeUpstreamSessionGraphQL,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

export type StudentPrivateProfileClassOption = {
  authorizationPath: string;
  classCode: string;
  className: string;
  id: string;
  resolvedAuthorityCode: string;
  studentCount: number;
};

export type StudentPrivateProfileClassOverviewStudent = {
  snapshotPresent: boolean;
  studentId: string;
  studentName: string | null;
  studentStatus: string | null;
  upstreamIdPresent: boolean;
};

export type StudentPrivateProfileClassOverview = {
  classCode: string;
  classId: string;
  className: string;
  studentCount: number;
  students: StudentPrivateProfileClassOverviewStudent[];
};

export type StudentConductGradeFieldCell = {
  conflict: boolean;
  displayValue?: string | null;
  source: string | null;
  value: number | string | null;
};

export type StudentConductGradeStudent = {
  conductSection: {
    snapshotPresent: boolean;
    sourceStatus: string;
    sourceTotal: number | null;
    warningCodes: string[];
  };
  conflictCodes: string[];
  fields: {
    confirmedGrade: StudentConductGradeFieldCell;
    estimatedGrade: StudentConductGradeFieldCell;
    score: StudentConductGradeFieldCell;
  };
  manualPatchFieldKeys: string[];
  status: string;
  studentId: string;
  studentName: string | null;
  studentStatus: string | null;
};

export type StudentConductGradeEffectiveView = {
  classCode: string;
  classId: string;
  className: string;
  schoolYear: string;
  sectionKey: string;
  semester: string;
  studentCount: number;
  students: StudentConductGradeStudent[];
};

export type StudentConductGradeCorrectionCleanupResult = {
  classCode: string;
  clearedFieldKeys: string[];
  remainingManualPatchFieldKeys: string[];
  schoolYear: string;
  semester: string;
  status: string;
  studentId: string;
  termKey: string;
};

export type StudentConductGradeEffectiveViewInput = {
  classCode: string;
  schoolYear: string;
  semester: string;
};

export type StudentConductGradeCorrectionCleanupInput = {
  classCode: string;
  schoolYear: string;
  semester: string;
  studentId: string;
};

export type StudentConductGradeClassTermOption = {
  isCurrent: boolean;
  label: string;
  schoolYear: string;
  semester: string;
};

export type StudentConductGradeClassTermOptions = {
  blockingReasonCode: string | null;
  blockingReasonMessage: string | null;
  currentSchoolYear: string | null;
  currentSemester: string | null;
  generationStatus: string;
  terms: StudentConductGradeClassTermOption[];
};

export type StudentConductGradeClassTermOptionsInput = {
  classCode: string;
};

export type StudentConductGradeSyncTermStatus = 'FAILED' | 'PARTIAL' | 'SKIPPED' | 'SYNCED';

export type RefreshStudentConductGradeTermResult = {
  failureCount: number;
  schoolYear: string;
  semester: string;
  status: StudentConductGradeSyncTermStatus;
  writtenStudentCount: number;
};

export type RefreshStudentConductGradeClassResult = {
  confirmedRegistrationCount: number;
  createdCount: number;
  expiresAt: string | null;
  failureCount: number;
  processedRegistrationCount: number;
  requestedRegistrationCount: number;
  skippedRegistrationCount: number;
  success: boolean;
  termResults: RefreshStudentConductGradeTermResult[];
  traceId: string | null;
  unchangedCount: number;
  upstreamSessionToken: string | null;
  upstreamTotal: number;
  updatedCount: number;
  writtenStudentCount: number;
};

export type RefreshStudentConductGradeClassInput = {
  classCode: string;
  schoolYear?: string | null;
  semester?: string | null;
  upstreamSessionToken: string;
};

export type StudentConductGradePatchFieldKey = 'confirmedGrade' | 'score';

export type PatchStudentConductGradeCorrectionStudentInput = {
  clearFieldKeys?: readonly StudentConductGradePatchFieldKey[] | null;
  confirmedGrade?: string | null;
  score?: string | null;
  studentId: string;
};

export type PatchStudentConductGradeCorrectionsInput = {
  classCode: string;
  schoolYear: string;
  semester: string;
  students: readonly PatchStudentConductGradeCorrectionStudentInput[];
};

export type PatchStudentConductGradeCorrectionRowResult = {
  clearedFieldKeys: string[];
  clearedUpstreamFieldKeys: string[];
  conductSectionStatus: string;
  createdSection: boolean;
  rowIndex: number;
  skippedUpstreamFieldKeys: string[];
  status: string;
  studentId: string;
  unchangedFieldKeys: string[];
  writtenFieldKeys: string[];
};

export type PatchStudentConductGradeCorrectionsResult = {
  affectedStudents: number;
  classCode: string;
  className: string;
  clearedFieldCount: number;
  clearedUpstreamFieldCount: number;
  createdSectionCount: number;
  rowResults: PatchStudentConductGradeCorrectionRowResult[];
  schoolYear: string;
  sectionKey: string;
  semester: string;
  skippedUpstreamFieldCount: number;
  status: string;
  totalRows: number;
  unchangedFieldCount: number;
  unchangedStudentCount: number;
  writtenFieldCount: number;
  writtenStudentCount: number;
};

export type StudentConductGradePatchRowIssue = {
  code: string;
  message?: string | null;
  rowIndex: number;
  studentId?: string | null;
};

type ClassOptionsResponse = {
  studentPrivateProfileClassOptions: StudentPrivateProfileClassOption[];
};

type ClassTermOptionsResponse = {
  studentConductGradeClassTermOptions: StudentConductGradeClassTermOptions;
};

type ClassOverviewResponse = {
  studentPrivateProfileClassOverview: StudentPrivateProfileClassOverview;
};

type ConductViewResponse = {
  studentConductGradeEffectiveView: StudentConductGradeEffectiveView;
};

type ConductCleanupResponse = {
  cleanupStudentConductGradeCorrection: StudentConductGradeCorrectionCleanupResult;
};

type ConductPatchResponse = {
  patchStudentConductGradeCorrections: PatchStudentConductGradeCorrectionsResult;
};

type RefreshConductClassResponse = {
  refreshStudentConductGradeClassFromUpstream: RefreshStudentConductGradeClassResult;
};

const CONDUCT_PATCH_FIELD_KEYS = ['score', 'confirmedGrade'] as const;
const CONDUCT_PATCH_FIELD_KEY_SET = new Set<string>(CONDUCT_PATCH_FIELD_KEYS);
const MAX_PATCH_STUDENT_ROWS = 500;

const CLASS_OPTIONS_QUERY = `
  query StudentConductGradeGovernanceClassOptions(
    $input: StudentPrivateProfileClassOptionsInput
  ) {
    studentPrivateProfileClassOptions(input: $input) {
      id
      classCode
      className
      studentCount
      resolvedAuthorityCode
      authorizationPath
    }
  }
`;

const CLASS_TERM_OPTIONS_QUERY = `
  query StudentConductGradeGovernanceClassTermOptions(
    $input: StudentConductGradeClassTermOptionsInput!
  ) {
    studentConductGradeClassTermOptions(input: $input) {
      generationStatus
      blockingReasonCode
      blockingReasonMessage
      currentSchoolYear
      currentSemester
      terms {
        schoolYear
        semester
        label
        isCurrent
      }
    }
  }
`;

const CLASS_OVERVIEW_QUERY = `
  query StudentConductGradeGovernanceClassOverview(
    $input: StudentPrivateProfileClassOverviewInput!
  ) {
    studentPrivateProfileClassOverview(input: $input) {
      classId
      classCode
      className
      studentCount
      students {
        studentId
        studentName
        studentStatus
        upstreamIdPresent
        snapshotPresent
      }
    }
  }
`;

const CONDUCT_VIEW_QUERY = `
  query StudentConductGradeGovernanceEffectiveView(
    $input: StudentConductGradeEffectiveViewInput!
  ) {
    studentConductGradeEffectiveView(input: $input) {
      sectionKey
      classId
      classCode
      className
      schoolYear
      semester
      studentCount
      students {
        studentId
        studentName
        studentStatus
        conductSection {
          snapshotPresent
          sourceStatus
          sourceTotal
          warningCodes
        }
        fields {
          score {
            value
            source
            conflict
          }
          estimatedGrade {
            value
            displayValue
            source
            conflict
          }
          confirmedGrade {
            value
            displayValue
            source
            conflict
          }
        }
        conflictCodes
        manualPatchFieldKeys
        status
      }
    }
  }
`;

const CLEANUP_CONDUCT_MUTATION = `
  mutation StudentConductGradeGovernanceCleanup(
    $input: StudentConductGradeCorrectionCleanupInput!
  ) {
    cleanupStudentConductGradeCorrection(input: $input) {
      status
      studentId
      classCode
      schoolYear
      semester
      termKey
      clearedFieldKeys
      remainingManualPatchFieldKeys
    }
  }
`;

const PATCH_CONDUCT_CORRECTIONS_MUTATION = `
  mutation StudentConductGradeGovernancePatchCorrections(
    $input: PatchStudentConductGradeCorrectionsInput!
  ) {
    patchStudentConductGradeCorrections(input: $input) {
      sectionKey
      classCode
      className
      schoolYear
      semester
      status
      totalRows
      affectedStudents
      writtenStudentCount
      unchangedStudentCount
      createdSectionCount
      writtenFieldCount
      clearedFieldCount
      clearedUpstreamFieldCount
      skippedUpstreamFieldCount
      unchangedFieldCount
      rowResults {
        rowIndex
        studentId
        conductSectionStatus
        status
        createdSection
        writtenFieldKeys
        clearedFieldKeys
        clearedUpstreamFieldKeys
        skippedUpstreamFieldKeys
        unchangedFieldKeys
      }
    }
  }
`;

const REFRESH_CONDUCT_CLASS_MUTATION = `
  mutation StudentConductGradeGovernanceRefreshClass(
    $input: RefreshStudentConductGradeClassFromUpstreamInput!
  ) {
    refreshStudentConductGradeClassFromUpstream(input: $input) {
      success
      requestedRegistrationCount
      upstreamTotal
      confirmedRegistrationCount
      processedRegistrationCount
      skippedRegistrationCount
      writtenStudentCount
      createdCount
      updatedCount
      unchangedCount
      failureCount
      upstreamSessionToken
      expiresAt
      traceId
      termResults {
        schoolYear
        semester
        status
        writtenStudentCount
        failureCount
      }
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function compactInput<TValue extends Record<string, unknown>>(input: TValue) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<TValue>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeConductPatchFieldKey(fieldKey: unknown): StudentConductGradePatchFieldKey {
  if (typeof fieldKey !== 'string' || !CONDUCT_PATCH_FIELD_KEY_SET.has(fieldKey)) {
    throw new Error('操行补录清除字段只支持 score、confirmedGrade。');
  }

  return fieldKey as StudentConductGradePatchFieldKey;
}

function normalizeConductPatchFieldKeys(
  fieldKeys: readonly StudentConductGradePatchFieldKey[] | null | undefined,
) {
  if (!fieldKeys?.length) {
    return undefined;
  }

  return Array.from(new Set(fieldKeys.map((fieldKey) => normalizeConductPatchFieldKey(fieldKey))));
}

function normalizeConductPatchStudent(student: PatchStudentConductGradeCorrectionStudentInput) {
  const studentId = normalizeRequiredTextValue(student.studentId, { label: '学生' });
  const score = normalizeOptionalTextValue(student.score, 'to_undefined');
  const confirmedGrade = normalizeOptionalTextValue(student.confirmedGrade, 'to_undefined');
  const clearFieldKeys = normalizeConductPatchFieldKeys(student.clearFieldKeys);

  for (const fieldKey of clearFieldKeys ?? []) {
    if (fieldKey === 'score' && score !== undefined) {
      throw new Error('同一个操行字段不能同时补录和清除。');
    }

    if (fieldKey === 'confirmedGrade' && confirmedGrade !== undefined) {
      throw new Error('同一个操行字段不能同时补录和清除。');
    }
  }

  const normalizedStudent = compactInput({
    clearFieldKeys,
    confirmedGrade,
    score,
    studentId,
  });

  if (!score && !confirmedGrade && !clearFieldKeys?.length) {
    throw new Error('每个学生至少需要一个操行补录或清除操作。');
  }

  return normalizedStudent;
}

export function normalizeConductViewInput(input: StudentConductGradeEffectiveViewInput) {
  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级代码' }),
    schoolYear: normalizeRequiredTextValue(input.schoolYear, { label: '学年' }),
    semester: normalizeRequiredTextValue(input.semester, { label: '学期' }),
  };
}

export function normalizeConductCleanupInput(input: StudentConductGradeCorrectionCleanupInput) {
  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级代码' }),
    schoolYear: normalizeRequiredTextValue(input.schoolYear, { label: '学年' }),
    semester: normalizeRequiredTextValue(input.semester, { label: '学期' }),
    studentId: normalizeRequiredTextValue(input.studentId, { label: '学生' }),
  };
}

export function normalizePatchStudentConductGradeCorrectionsInput(
  input: PatchStudentConductGradeCorrectionsInput,
) {
  if (input.students.length === 0) {
    throw new Error('请至少选择一名需要补录操行的学生。');
  }

  if (input.students.length > MAX_PATCH_STUDENT_ROWS) {
    throw new Error(`单次操行补录最多提交 ${MAX_PATCH_STUDENT_ROWS} 名学生。`);
  }

  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级代码' }),
    schoolYear: normalizeRequiredTextValue(input.schoolYear, { label: '学年' }),
    semester: normalizeRequiredTextValue(input.semester, { label: '学期' }),
    students: input.students.map((student) => normalizeConductPatchStudent(student)),
  };
}

export function normalizeConductClassTermOptionsInput(
  input: StudentConductGradeClassTermOptionsInput,
) {
  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级代码' }),
  };
}

export function normalizeRefreshConductClassInput(input: RefreshStudentConductGradeClassInput) {
  const schoolYear = normalizeOptionalTextValue(input.schoolYear, 'to_undefined');
  const semester = normalizeOptionalTextValue(input.semester, 'to_undefined');

  if (semester && !schoolYear) {
    throw new Error('同步指定学期时必须同时提供学年。');
  }

  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级代码' }),
    schoolYear,
    semester,
    upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
      label: 'upstream session token',
    }),
  };
}

export function normalizeClassOverviewInput(input: { classId: string }) {
  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级' }),
  };
}

export function readStudentConductGradePatchRowIssues(
  error: unknown,
): StudentConductGradePatchRowIssue[] {
  if (!isGraphQLIngressError(error)) {
    return [];
  }

  return (
    error.graphqlErrors?.flatMap((graphqlError) => {
      const extensions = graphqlError.extensions as Record<string, unknown> | undefined;
      const details = extensions?.details;
      const rowIssues = isRecord(details) ? details.rowIssues : undefined;

      if (!Array.isArray(rowIssues)) {
        return [];
      }

      return rowIssues
        .map((rowIssue) => {
          if (!isRecord(rowIssue)) {
            return null;
          }

          const rowIndex = rowIssue.rowIndex;
          const code = rowIssue.code;

          if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex)) {
            return null;
          }

          if (typeof code !== 'string' || !code.trim()) {
            return null;
          }

          return {
            code: code.trim(),
            message: typeof rowIssue.message === 'string' ? rowIssue.message : null,
            rowIndex,
            studentId: typeof rowIssue.studentId === 'string' ? rowIssue.studentId : null,
          };
        })
        .filter((rowIssue): rowIssue is StudentConductGradePatchRowIssue => Boolean(rowIssue));
    }) ?? []
  );
}

export function resolveStudentConductGradePatchErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string' && extensions.errorMessage.trim()) {
      return extensions.errorMessage;
    }

    if (
      typeof firstError?.message === 'string' &&
      firstError.message.trim() &&
      firstError.message !== extensions.code &&
      firstError.message !== extensions.errorCode
    ) {
      return firstError.message;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function listStudentPrivateProfileClassOptions() {
  const response = await requestGraphQL<
    ClassOptionsResponse,
    {
      input: Record<string, never>;
    }
  >(CLASS_OPTIONS_QUERY, {
    input: {},
  });

  return response.studentPrivateProfileClassOptions;
}

export async function fetchStudentPrivateProfileClassOverview(input: { classId: string }) {
  const response = await requestGraphQL<
    ClassOverviewResponse,
    {
      input: ReturnType<typeof normalizeClassOverviewInput>;
    }
  >(CLASS_OVERVIEW_QUERY, {
    input: normalizeClassOverviewInput(input),
  });

  return response.studentPrivateProfileClassOverview;
}

export async function fetchStudentConductGradeClassTermOptions(
  input: StudentConductGradeClassTermOptionsInput,
) {
  const response = await requestGraphQL<
    ClassTermOptionsResponse,
    {
      input: ReturnType<typeof normalizeConductClassTermOptionsInput>;
    }
  >(CLASS_TERM_OPTIONS_QUERY, {
    input: normalizeConductClassTermOptionsInput(input),
  });

  return response.studentConductGradeClassTermOptions;
}

export async function fetchStudentConductGradeEffectiveView(
  input: StudentConductGradeEffectiveViewInput,
) {
  const response = await requestGraphQL<
    ConductViewResponse,
    {
      input: ReturnType<typeof normalizeConductViewInput>;
    }
  >(CONDUCT_VIEW_QUERY, {
    input: normalizeConductViewInput(input),
  });

  return response.studentConductGradeEffectiveView;
}

export async function cleanupStudentConductGradeCorrection(
  input: StudentConductGradeCorrectionCleanupInput,
) {
  const response = await requestGraphQL<
    ConductCleanupResponse,
    {
      input: ReturnType<typeof normalizeConductCleanupInput>;
    }
  >(CLEANUP_CONDUCT_MUTATION, {
    input: normalizeConductCleanupInput(input),
  });

  return response.cleanupStudentConductGradeCorrection;
}

export async function patchStudentConductGradeCorrections(
  input: PatchStudentConductGradeCorrectionsInput,
) {
  const response = await requestGraphQL<
    ConductPatchResponse,
    {
      input: ReturnType<typeof normalizePatchStudentConductGradeCorrectionsInput>;
    }
  >(PATCH_CONDUCT_CORRECTIONS_MUTATION, {
    input: normalizePatchStudentConductGradeCorrectionsInput(input),
  });

  return response.patchStudentConductGradeCorrections;
}

export async function refreshStudentConductGradeClassFromUpstream(
  input: RefreshStudentConductGradeClassInput,
) {
  const response = await executeUpstreamSessionGraphQL<
    RefreshConductClassResponse,
    {
      input: ReturnType<typeof normalizeRefreshConductClassInput>;
    }
  >(REFRESH_CONDUCT_CLASS_MUTATION, {
    input: normalizeRefreshConductClassInput(input),
  });

  return response.refreshStudentConductGradeClassFromUpstream;
}
