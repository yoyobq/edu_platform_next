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
import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

export type StudentPrivateProfileClassOption = {
  authorizationPath: string;
  classCode: string;
  className: string;
  id: string;
  resolvedAuthorityCode: string;
  studentCount: number;
};

export type StudentPrivateProfileCompletenessFlags = {
  educationObserved: boolean;
  familyObserved: boolean;
  personalObserved: boolean;
  photoObserved: boolean;
  recordObserved: boolean;
  sensitiveIdentifiersObserved: boolean;
};

export type StudentPrivateProfileClassOverviewSectionStatus = {
  lastManualUpdatedAt: string | null;
  manualOverrideActive: boolean;
  section: string;
  snapshotPresent: boolean;
  sourceStatus: string;
  upstreamChangedSinceManualPatch: boolean;
  warningCodes: string[];
};

export type StudentPrivateProfileClassOverviewStudent = {
  attentionLevel: string;
  lastSyncedAt: string | null;
  manualOverrideActive: boolean;
  profileCompletenessFlags: StudentPrivateProfileCompletenessFlags;
  sectionStatuses: StudentPrivateProfileClassOverviewSectionStatus[];
  snapshotPresent: boolean;
  sourceObservedAt: string | null;
  studentId: string;
  studentName: string | null;
  studentStatus: string | null;
  upstreamChangedSinceManualPatch: boolean;
  upstreamIdPresent: boolean;
  warningCodes: string[];
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
  summary: {
    correctionCleanupPendingCount: number;
    localCorrectionCount: number;
    missingCount: number;
    upstreamChangedSinceCorrectionCount: number;
    upstreamConfirmedCount: number;
  };
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

type RefreshConductClassResponse = {
  refreshStudentConductGradeClassFromUpstream: RefreshStudentConductGradeClassResult;
};

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
        sourceObservedAt
        lastSyncedAt
        manualOverrideActive
        upstreamChangedSinceManualPatch
        attentionLevel
        warningCodes
        profileCompletenessFlags {
          personalObserved
          sensitiveIdentifiersObserved
          photoObserved
          familyObserved
          educationObserved
          recordObserved
        }
        sectionStatuses {
          section
          sourceStatus
          snapshotPresent
          lastManualUpdatedAt
          manualOverrideActive
          upstreamChangedSinceManualPatch
          warningCodes
        }
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
      summary {
        upstreamConfirmedCount
        localCorrectionCount
        missingCount
        correctionCleanupPendingCount
        upstreamChangedSinceCorrectionCount
      }
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
