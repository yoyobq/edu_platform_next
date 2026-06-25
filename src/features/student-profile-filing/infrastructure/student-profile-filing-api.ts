// src/features/student-profile-filing/infrastructure/student-profile-filing-api.ts

import type { OperationVariables } from '@apollo/client';

import {
  executeUpstreamSessionGraphQL,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { normalizeRequiredTextValue } from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

export type StudentProfileFilingCompletenessFlags = {
  educationObserved: boolean;
  familyObserved: boolean;
  personalObserved: boolean;
  photoObserved: boolean;
  recordObserved: boolean;
  sensitiveIdentifiersObserved: boolean;
};

export type StudentProfileFilingClassOverviewAttentionLevel =
  | 'INCOMPLETE'
  | 'MANUAL_OVERRIDE'
  | 'MISSING_SNAPSHOT'
  | 'READY'
  | 'UPSTREAM_ID_MISSING'
  | 'WARNING';

export type StudentProfileFilingClassOption = {
  authorizationPath: string;
  classCode: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
  resolvedAuthorityCode: string;
  studentCount: number;
};

export type StudentProfileFilingSectionStatus = {
  lastManualUpdatedAt: string | null;
  manualOverrideActive: boolean;
  observedAt: string;
  section: string;
  snapshotPresent: boolean;
  sourceEndpoint: string;
  sourceStatus: string;
  sourceTotal: number | null;
  upstreamChangedSinceManualPatch: boolean;
  warningCodes: string[];
};

export type StudentProfileFilingStudent = {
  activeMembershipClassCode: string;
  activeMembershipClassName: string;
  attentionLevel: StudentProfileFilingClassOverviewAttentionLevel;
  currentClassCode: string | null;
  currentClassId: string | null;
  lastManualUpdatedAt: string | null;
  lastSyncedAt: string | null;
  manualOverrideActive: boolean;
  membershipLastObservedAt: string | null;
  profileCompletenessFlags: StudentProfileFilingCompletenessFlags;
  sectionStatuses: StudentProfileFilingSectionStatus[];
  snapshotPresent: boolean;
  sourceObservedAt: string | null;
  studentId: string;
  studentName: string;
  upstreamChangedSinceManualPatch: boolean;
  upstreamIdPresent: boolean;
  warningCodes: string[];
};

export type StudentProfileFilingClassOverview = {
  classCode: string;
  classId: string;
  className: string;
  studentCount: number;
  students: StudentProfileFilingStudent[];
};

export type StudentProfileFilingRefreshWarning = {
  code: string;
  fieldPath: string | null;
  message: string;
};

export type StudentProfileFilingRefreshResult = {
  changedSections: string[];
  expiresAt: string | null;
  lastSyncedAt: string | null;
  photoByteSize: number | null;
  photoPresent: boolean;
  snapshotUpdated: boolean;
  sourceObservedAt: string | null;
  studentId: string;
  success: boolean;
  traceId: string;
  upstreamSessionToken: string | null;
  warnings: StudentProfileFilingRefreshWarning[];
};

export type StudentProfileFilingBatchRefreshItem = {
  changedSections: string[];
  errorCode: string | null;
  errorMessage: string | null;
  snapshotUpdated: boolean | null;
  status: string;
  studentId: string;
  warningCodes: string[];
};

export type StudentProfileFilingBatchRefreshResult = {
  expiresAt: string | null;
  failureCount: number;
  requestedCount: number;
  results: StudentProfileFilingBatchRefreshItem[];
  success: boolean;
  successCount: number;
  traceId: string;
  upstreamSessionToken: string | null;
};

export type StudentProfileFilingClassRefreshResult = StudentProfileFilingBatchRefreshResult & {
  chunkIntervalMs: number;
  chunkSize: number;
  classCode: string;
  classId: string;
  className: string;
};

type StudentProfileFilingClassOptionsResponse = {
  studentPrivateProfileClassOptions: StudentProfileFilingClassOption[];
};

type StudentProfileFilingClassOverviewResponse = {
  studentPrivateProfileClassOverview: StudentProfileFilingClassOverview;
};

type StudentProfileFilingRefreshResponse = {
  refreshStudentPrivateProfileFromUpstream: StudentProfileFilingRefreshResult;
};

type StudentProfileFilingBatchRefreshResponse = {
  refreshStudentPrivateProfilesFromUpstream: StudentProfileFilingBatchRefreshResult;
};

type StudentProfileFilingClassRefreshResponse = {
  refreshStudentPrivateProfileClassFromUpstream: StudentProfileFilingClassRefreshResult;
};

const STUDENT_PROFILE_FILING_CLASS_OPTIONS_QUERY = `
  query StudentProfileFilingClassOptions($input: StudentPrivateProfileClassOptionsInput) {
    studentPrivateProfileClassOptions(input: $input) {
      id
      departmentId
      classCode
      className
      gradeYear
      studentCount
      resolvedAuthorityCode
      authorizationPath
    }
  }
`;

const STUDENT_PROFILE_FILING_CLASS_OVERVIEW_QUERY = `
  query StudentProfileFilingClassOverview($input: StudentPrivateProfileClassOverviewInput!) {
    studentPrivateProfileClassOverview(input: $input) {
      classId
      classCode
      className
      studentCount
      students {
        studentId
        studentName
        upstreamIdPresent
        currentClassId
        currentClassCode
        activeMembershipClassCode
        activeMembershipClassName
        membershipLastObservedAt
        snapshotPresent
        sourceObservedAt
        lastSyncedAt
        lastManualUpdatedAt
        manualOverrideActive
        upstreamChangedSinceManualPatch
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
          observedAt
          sourceEndpoint
          sourceTotal
          snapshotPresent
          lastManualUpdatedAt
          manualOverrideActive
          upstreamChangedSinceManualPatch
          warningCodes
        }
        warningCodes
        attentionLevel
      }
    }
  }
`;

const REFRESH_STUDENT_PROFILE_MUTATION = `
  mutation StudentProfileFilingRefresh($input: RefreshStudentPrivateProfileFromUpstreamInput!) {
    refreshStudentPrivateProfileFromUpstream(input: $input) {
      success
      studentId
      snapshotUpdated
      sourceObservedAt
      lastSyncedAt
      changedSections
      warnings {
        code
        fieldPath
        message
      }
      photoPresent
      photoByteSize
      upstreamSessionToken
      expiresAt
      traceId
    }
  }
`;

const REFRESH_STUDENT_PROFILES_MUTATION = `
  mutation StudentProfileFilingBatchRefresh(
    $input: RefreshStudentPrivateProfilesFromUpstreamInput!
  ) {
    refreshStudentPrivateProfilesFromUpstream(input: $input) {
      success
      requestedCount
      successCount
      failureCount
      upstreamSessionToken
      expiresAt
      traceId
      results {
        studentId
        status
        snapshotUpdated
        changedSections
        warningCodes
        errorCode
        errorMessage
      }
    }
  }
`;

const REFRESH_STUDENT_PROFILE_CLASS_MUTATION = `
  mutation StudentProfileFilingClassRefresh(
    $input: RefreshStudentPrivateProfileClassFromUpstreamInput!
  ) {
    refreshStudentPrivateProfileClassFromUpstream(input: $input) {
      classId
      classCode
      className
      success
      requestedCount
      successCount
      failureCount
      upstreamSessionToken
      expiresAt
      traceId
      chunkSize
      chunkIntervalMs
      results {
        studentId
        status
        snapshotUpdated
        changedSections
        warningCodes
        errorCode
        errorMessage
      }
    }
  }
`;

function normalizeStudentId(studentId: string | null | undefined) {
  return normalizeRequiredTextValue(studentId, { label: '学生' });
}

export function normalizeStudentProfileFilingClassOverviewInput(input: {
  classId: string | null | undefined;
}) {
  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级' }),
  };
}

export function normalizeStudentProfileFilingRefreshInput(input: {
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  const upstreamSessionToken = normalizeRequiredTextValue(input.upstreamSessionToken, {
    label: 'upstream session token',
  });

  if (upstreamSessionToken.length > 4096) {
    throw new Error('upstream session token 不能超过 4096 个字符。');
  }

  return {
    studentId: normalizeStudentId(input.studentId),
    upstreamSessionToken,
  };
}

export function normalizeStudentProfileFilingClassRefreshInput(input: {
  classId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  const upstreamSessionToken = normalizeRequiredTextValue(input.upstreamSessionToken, {
    label: 'upstream session token',
  });

  if (upstreamSessionToken.length > 4096) {
    throw new Error('upstream session token 不能超过 4096 个字符。');
  }

  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级' }),
    upstreamSessionToken,
  };
}

export function normalizeStudentProfileFilingBatchRefreshStudentIds(
  studentIdsInput: readonly (string | null | undefined)[],
) {
  const studentIds: string[] = [];
  const observedStudentIds = new Set<string>();

  studentIdsInput.forEach((studentId) => {
    const normalizedStudentId = studentId?.trim() ?? '';

    if (!normalizedStudentId) {
      return;
    }

    if (normalizedStudentId.length > 32) {
      throw new Error('学生 ID 不能超过 32 个字符。');
    }

    if (observedStudentIds.has(normalizedStudentId)) {
      return;
    }

    observedStudentIds.add(normalizedStudentId);
    studentIds.push(normalizedStudentId);
  });

  if (studentIds.length === 0) {
    throw new Error('请选择至少 1 个学生。');
  }

  if (studentIds.length > 20) {
    throw new Error('一次最多建档或更新 20 个学生。');
  }

  return studentIds;
}

export function normalizeStudentProfileFilingBatchRefreshInput(input: {
  studentIds: readonly (string | null | undefined)[];
  upstreamSessionToken: string | null | undefined;
}) {
  const upstreamSessionToken = normalizeRequiredTextValue(input.upstreamSessionToken, {
    label: 'upstream session token',
  });

  if (upstreamSessionToken.length > 4096) {
    throw new Error('upstream session token 不能超过 4096 个字符。');
  }

  return {
    studentIds: normalizeStudentProfileFilingBatchRefreshStudentIds(input.studentIds),
    upstreamSessionToken,
  };
}

export async function listStudentProfileFilingClassOptions() {
  try {
    const response = await executeGraphQL<
      StudentProfileFilingClassOptionsResponse,
      OperationVariables & {
        input: Record<string, never>;
      }
    >(STUDENT_PROFILE_FILING_CLASS_OPTIONS_QUERY, { input: {} });

    return response.studentPrivateProfileClassOptions;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载可建档班级。'));
  }
}

export async function getStudentProfileFilingClassOverview(input: {
  classId: string | null | undefined;
}) {
  try {
    const response = await executeGraphQL<
      StudentProfileFilingClassOverviewResponse,
      OperationVariables & {
        input: ReturnType<typeof normalizeStudentProfileFilingClassOverviewInput>;
      }
    >(STUDENT_PROFILE_FILING_CLASS_OVERVIEW_QUERY, {
      input: normalizeStudentProfileFilingClassOverviewInput(input),
    });

    return response.studentPrivateProfileClassOverview;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载班级建档概览。'));
  }
}

export async function refreshStudentProfileFilingStudent(input: {
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  const response = await executeUpstreamSessionGraphQL<
    StudentProfileFilingRefreshResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentProfileFilingRefreshInput>;
    }
  >(REFRESH_STUDENT_PROFILE_MUTATION, {
    input: normalizeStudentProfileFilingRefreshInput(input),
  });

  return response.refreshStudentPrivateProfileFromUpstream;
}

export async function refreshStudentProfileFilingStudents(input: {
  studentIds: readonly (string | null | undefined)[];
  upstreamSessionToken: string | null | undefined;
}) {
  const response = await executeUpstreamSessionGraphQL<
    StudentProfileFilingBatchRefreshResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentProfileFilingBatchRefreshInput>;
    }
  >(REFRESH_STUDENT_PROFILES_MUTATION, {
    input: normalizeStudentProfileFilingBatchRefreshInput(input),
  });

  return response.refreshStudentPrivateProfilesFromUpstream;
}

export async function refreshStudentProfileFilingClass(input: {
  classId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  const response = await executeUpstreamSessionGraphQL<
    StudentProfileFilingClassRefreshResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentProfileFilingClassRefreshInput>;
    }
  >(REFRESH_STUDENT_PROFILE_CLASS_MUTATION, {
    input: normalizeStudentProfileFilingClassRefreshInput(input),
  });

  return response.refreshStudentPrivateProfileClassFromUpstream;
}
