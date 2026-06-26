// src/features/student-profile-filing/infrastructure/student-profile-filing-api.ts

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

export type StudentProfileFilingRosterScopeSource = 'ACTIVE_MEMBERSHIP' | 'DROPPED_DECISION';

export type StudentProfileFilingClassAdviser = {
  isTemporary: boolean;
  staffId: string;
  staffName: string;
};

export type StudentProfileFilingClassOption = {
  authorizationPath: string;
  classAdvisers: StudentProfileFilingClassAdviser[];
  classCode: string;
  classEnrollmentYear: number | null;
  classExpectedGraduationYear: number | null;
  classInSchool: boolean | null;
  className: string;
  classSchoolYearRangeLabel: string | null;
  departmentId: string;
  gradeYear: number | null;
  id: string;
  majorId: string | null;
  majorName: string | null;
  resolvedAuthorityCode: string;
  studentCount: number;
  trainingYears: number | null;
};

type StudentProfileFilingClassOptionContextFields = Pick<
  StudentProfileFilingClassOption,
  | 'classAdvisers'
  | 'classEnrollmentYear'
  | 'classExpectedGraduationYear'
  | 'classInSchool'
  | 'classSchoolYearRangeLabel'
  | 'majorId'
  | 'majorName'
  | 'trainingYears'
>;

type StudentProfileFilingRawClassOption = Omit<
  StudentProfileFilingClassOption,
  keyof StudentProfileFilingClassOptionContextFields
> &
  Partial<StudentProfileFilingClassOptionContextFields>;

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
  droppedDecisionReasonCode: string | null;
  droppedEffectiveSemesterId: number | null;
  droppedEffectiveSemesterLabel: string | null;
  lastManualUpdatedAt: string | null;
  lastSyncedAt: string | null;
  manualOverrideActive: boolean;
  membershipLastObservedAt: string | null;
  profileCompletenessFlags: StudentProfileFilingCompletenessFlags;
  rosterScopeSource: StudentProfileFilingRosterScopeSource;
  sectionStatuses: StudentProfileFilingSectionStatus[];
  snapshotPresent: boolean;
  sourceObservedAt: string | null;
  studentId: string;
  studentName: string;
  studentStatus: string;
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

export type StudentProfileFilingSupplementSectionKey = 'EDUCATION_RESUME' | 'FAMILY';

export type StudentProfileFilingSupplementSummarySectionStatus = {
  section: string;
  sectionBaselineToken: string | null;
  sourceStatus: string;
};

export type StudentProfileFilingSupplementFamilyMember = {
  itemKey: string;
  manualOverrideActive: boolean;
  manualPatchFieldKeys: string[];
  maskedName: string | null;
  maskedPhone: string | null;
  maskedWorkplace: string | null;
  relationshipCode: string;
  sourceObservedAt: string;
  sourceUpdatedAt: string | null;
  upstreamBaselineToken: string;
  upstreamChangedSinceManualPatch: boolean;
};

export type StudentProfileFilingSupplementEducationResume = {
  endMonth: string | null;
  itemKey: string;
  maskedOrganization: string | null;
  maskedReference: string | null;
  sourceObservedAt: string;
  sourceUpdatedAt: string | null;
  startMonth: string | null;
  upstreamBaselineToken: string;
};

export type StudentProfileFilingSupplementSummary = {
  educationResumes: StudentProfileFilingSupplementEducationResume[];
  familyMembers: StudentProfileFilingSupplementFamilyMember[];
  profileCompletenessFlags: StudentProfileFilingCompletenessFlags;
  sectionStatuses: StudentProfileFilingSupplementSummarySectionStatus[];
  studentId: string;
};

export type StudentProfileFilingFamilySupplementInput = {
  expectedSectionBaselineToken: string | null | undefined;
  member: {
    name: string | null | undefined;
    phone?: string | null | undefined;
    relationshipCode: string | null | undefined;
    workplace?: string | null | undefined;
  };
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
};

export type StudentProfileFilingEducationSupplementInput = {
  expectedSectionBaselineToken: string | null | undefined;
  resume: {
    endDate: string | null | undefined;
    organization: string | null | undefined;
    reference: string | null | undefined;
    startDate: string | null | undefined;
  };
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
};

export type StudentProfileFilingSupplementWriteResult = {
  action: 'CREATE' | string;
  changedSections: string[];
  expiresAt: string | null;
  localSnapshotRefreshed: boolean;
  sectionKey: StudentProfileFilingSupplementSectionKey;
  snapshotUpdated: boolean;
  sourceObservedAt: string;
  studentId: string;
  success: boolean;
  summaryRefreshFailed: boolean;
  traceId: string;
  upstreamSaved: boolean;
  upstreamSessionToken: string | null;
  warningCodes: string[];
};

type StudentProfileFilingClassOptionsResponse = {
  studentPrivateProfileClassOptions: StudentProfileFilingRawClassOption[];
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

type StudentProfileFilingSupplementSummaryResponse = {
  studentPrivateProfileSummary: StudentProfileFilingSupplementSummary;
};

type StudentProfileFilingFamilySupplementResponse = {
  writeStudentPrivateProfileFamilyToUpstream: StudentProfileFilingSupplementWriteResult;
};

type StudentProfileFilingEducationSupplementResponse = {
  writeStudentPrivateProfileEducationToUpstream: StudentProfileFilingSupplementWriteResult;
};

const STUDENT_PROFILE_FILING_CLASS_OPTIONS_QUERY = `
  query StudentProfileFilingClassOptions($input: StudentPrivateProfileClassOptionsInput) {
    studentPrivateProfileClassOptions(input: $input) {
      id
      departmentId
      classCode
      className
      classAdvisers {
        staffId
        staffName
        isTemporary
      }
      majorId
      majorName
      trainingYears
      classEnrollmentYear
      classExpectedGraduationYear
      classInSchool
      classSchoolYearRangeLabel
      gradeYear
      studentCount
      resolvedAuthorityCode
      authorizationPath
    }
  }
`;

const STUDENT_PROFILE_FILING_LEGACY_CLASS_OPTIONS_QUERY = `
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
        studentStatus
        upstreamIdPresent
        currentClassId
        currentClassCode
        activeMembershipClassCode
        activeMembershipClassName
        rosterScopeSource
        droppedDecisionReasonCode
        droppedEffectiveSemesterId
        droppedEffectiveSemesterLabel
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

const STUDENT_PROFILE_FILING_SUPPLEMENT_SUMMARY_QUERY = `
  query StudentProfileFilingSupplementSummary($input: StudentPrivateProfileSummaryInput!) {
    studentPrivateProfileSummary(input: $input) {
      studentId
      familyMembers {
        itemKey
        upstreamBaselineToken
        relationshipCode
        maskedName
        maskedPhone
        maskedWorkplace
        manualOverrideActive
        upstreamChangedSinceManualPatch
        manualPatchFieldKeys
        sourceUpdatedAt
        sourceObservedAt
      }
      educationResumes {
        itemKey
        upstreamBaselineToken
        startMonth
        endMonth
        maskedReference
        maskedOrganization
        sourceUpdatedAt
        sourceObservedAt
      }
      sectionStatuses {
        section
        sectionBaselineToken
        sourceStatus
      }
      profileCompletenessFlags {
        personalObserved
        sensitiveIdentifiersObserved
        photoObserved
        familyObserved
        educationObserved
        recordObserved
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

const STUDENT_PROFILE_FILING_SUPPLEMENT_WRITE_RESULT_FIELDS = `
  success
  studentId
  sectionKey
  action
  upstreamSaved
  localSnapshotRefreshed
  snapshotUpdated
  sourceObservedAt
  changedSections
  warningCodes
  upstreamSessionToken
  expiresAt
  traceId
  summaryRefreshFailed
`;

const WRITE_STUDENT_PROFILE_FILING_FAMILY_SUPPLEMENT_MUTATION = `
  mutation StudentProfileFilingWriteFamilySupplement(
    $input: WriteStudentPrivateProfileFamilyToUpstreamInput!
  ) {
    writeStudentPrivateProfileFamilyToUpstream(input: $input) {
      ${STUDENT_PROFILE_FILING_SUPPLEMENT_WRITE_RESULT_FIELDS}
    }
  }
`;

const WRITE_STUDENT_PROFILE_FILING_EDUCATION_SUPPLEMENT_MUTATION = `
  mutation StudentProfileFilingWriteEducationSupplement(
    $input: WriteStudentPrivateProfileEducationToUpstreamInput!
  ) {
    writeStudentPrivateProfileEducationToUpstream(input: $input) {
      ${STUDENT_PROFILE_FILING_SUPPLEMENT_WRITE_RESULT_FIELDS}
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

function normalizeStudentProfileFilingSectionBaselineToken(
  expectedSectionBaselineToken: string | null | undefined,
) {
  return normalizeRequiredTextValue(expectedSectionBaselineToken, {
    label: '资料版本校验码',
  });
}

function normalizeStudentProfileFilingUpstreamSessionToken(
  upstreamSessionTokenInput: string | null | undefined,
) {
  const upstreamSessionToken = normalizeRequiredTextValue(upstreamSessionTokenInput, {
    label: 'upstream session token',
  });

  if (upstreamSessionToken.length > 4096) {
    throw new Error('upstream session token 不能超过 4096 个字符。');
  }

  return upstreamSessionToken;
}

function normalizeStudentProfileFilingRelationshipCode(
  relationshipCode: string | null | undefined,
) {
  const normalizedRelationshipCode = normalizeRequiredTextValue(relationshipCode, {
    label: '家庭关系',
  });

  if (!new Set(['1', '2']).has(normalizedRelationshipCode)) {
    throw new Error('家庭关系暂只支持父亲、母亲。');
  }

  return normalizedRelationshipCode;
}

const STUDENT_PROFILE_FILING_WRITE_THROUGH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeStudentProfileFilingWriteThroughDate(
  value: string | null | undefined,
  label: string,
) {
  const normalizedValue = normalizeRequiredTextValue(value, { label });
  const date = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (
    !STUDENT_PROFILE_FILING_WRITE_THROUGH_DATE_PATTERN.test(normalizedValue) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalizedValue
  ) {
    throw new Error(`${label}必须是合法日期，格式为 YYYY-MM-DD。`);
  }

  return normalizedValue;
}

export function normalizeStudentProfileFilingFamilySupplementInput(
  input: StudentProfileFilingFamilySupplementInput,
) {
  return {
    expectedSectionBaselineToken: normalizeStudentProfileFilingSectionBaselineToken(
      input.expectedSectionBaselineToken,
    ),
    members: [
      {
        action: 'CREATE' as const,
        name: normalizeRequiredTextValue(input.member.name, { label: '家庭成员姓名' }),
        phone: normalizeOptionalTextValue(input.member.phone, 'to_undefined'),
        relationshipCode: normalizeStudentProfileFilingRelationshipCode(
          input.member.relationshipCode,
        ),
        workplace: normalizeOptionalTextValue(input.member.workplace, 'to_undefined'),
      },
    ],
    studentId: normalizeStudentId(input.studentId),
    upstreamSessionToken: normalizeStudentProfileFilingUpstreamSessionToken(
      input.upstreamSessionToken,
    ),
  };
}

export function normalizeStudentProfileFilingEducationSupplementInput(
  input: StudentProfileFilingEducationSupplementInput,
) {
  const startDate = normalizeStudentProfileFilingWriteThroughDate(
    input.resume.startDate,
    '开始日期',
  );
  const endDate = normalizeStudentProfileFilingWriteThroughDate(input.resume.endDate, '结束日期');

  if (startDate > endDate) {
    throw new Error('开始日期不能晚于结束日期。');
  }

  return {
    expectedSectionBaselineToken: normalizeStudentProfileFilingSectionBaselineToken(
      input.expectedSectionBaselineToken,
    ),
    resumes: [
      {
        action: 'CREATE' as const,
        endDate,
        organization: normalizeRequiredTextValue(input.resume.organization, { label: '学校' }),
        reference: normalizeRequiredTextValue(input.resume.reference, { label: '证明人' }),
        startDate,
      },
    ],
    studentId: normalizeStudentId(input.studentId),
    upstreamSessionToken: normalizeStudentProfileFilingUpstreamSessionToken(
      input.upstreamSessionToken,
    ),
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

function normalizeStudentProfileFilingClassOption(
  option: StudentProfileFilingRawClassOption,
): StudentProfileFilingClassOption {
  return {
    ...option,
    classAdvisers: option.classAdvisers ?? [],
    classEnrollmentYear: option.classEnrollmentYear ?? null,
    classExpectedGraduationYear: option.classExpectedGraduationYear ?? null,
    classInSchool: option.classInSchool ?? null,
    classSchoolYearRangeLabel: option.classSchoolYearRangeLabel ?? null,
    majorId: option.majorId ?? null,
    majorName: option.majorName ?? null,
    trainingYears: option.trainingYears ?? null,
  };
}

function isStudentProfileFilingClassOptionSchemaMismatch(error: unknown) {
  const graphqlErrors =
    typeof error === 'object' &&
    error !== null &&
    'graphqlErrors' in error &&
    Array.isArray((error as { graphqlErrors?: unknown }).graphqlErrors)
      ? ((error as { graphqlErrors: { message?: unknown }[] }).graphqlErrors ?? [])
      : [];
  const messages = [
    error instanceof Error ? error.message : '',
    ...graphqlErrors.map((graphqlError) =>
      typeof graphqlError.message === 'string' ? graphqlError.message : '',
    ),
  ];

  return messages.some((message) =>
    /Cannot query field "(classAdvisers|majorId|majorName|trainingYears|classEnrollmentYear|classExpectedGraduationYear|classInSchool|classSchoolYearRangeLabel)" on type "StudentPrivateProfileClassOptionDTO"/.test(
      message,
    ),
  );
}

async function executeStudentProfileFilingClassOptionsQuery(query: string) {
  const response = await executeGraphQL<
    StudentProfileFilingClassOptionsResponse,
    OperationVariables & {
      input: Record<string, never>;
    }
  >(query, { input: {} });

  return response.studentPrivateProfileClassOptions.map((option) =>
    normalizeStudentProfileFilingClassOption(option),
  );
}

export async function listStudentProfileFilingClassOptions() {
  try {
    return await executeStudentProfileFilingClassOptionsQuery(
      STUDENT_PROFILE_FILING_CLASS_OPTIONS_QUERY,
    );
  } catch (error) {
    if (isStudentProfileFilingClassOptionSchemaMismatch(error)) {
      return executeStudentProfileFilingClassOptionsQuery(
        STUDENT_PROFILE_FILING_LEGACY_CLASS_OPTIONS_QUERY,
      );
    }

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

export async function getStudentProfileFilingSupplementSummary(input: {
  studentId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    StudentProfileFilingSupplementSummaryResponse,
    OperationVariables & {
      input: {
        studentId: string;
      };
    }
  >(STUDENT_PROFILE_FILING_SUPPLEMENT_SUMMARY_QUERY, {
    input: {
      studentId: normalizeStudentId(input.studentId),
    },
  });

  return response.studentPrivateProfileSummary;
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

export async function writeStudentProfileFilingFamilySupplement(
  input: StudentProfileFilingFamilySupplementInput,
) {
  const response = await executeUpstreamSessionGraphQL<
    StudentProfileFilingFamilySupplementResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentProfileFilingFamilySupplementInput>;
    }
  >(WRITE_STUDENT_PROFILE_FILING_FAMILY_SUPPLEMENT_MUTATION, {
    input: normalizeStudentProfileFilingFamilySupplementInput(input),
  });

  return response.writeStudentPrivateProfileFamilyToUpstream;
}

export async function writeStudentProfileFilingEducationSupplement(
  input: StudentProfileFilingEducationSupplementInput,
) {
  const response = await executeUpstreamSessionGraphQL<
    StudentProfileFilingEducationSupplementResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentProfileFilingEducationSupplementInput>;
    }
  >(WRITE_STUDENT_PROFILE_FILING_EDUCATION_SUPPLEMENT_MUTATION, {
    input: normalizeStudentProfileFilingEducationSupplementInput(input),
  });

  return response.writeStudentPrivateProfileEducationToUpstream;
}
