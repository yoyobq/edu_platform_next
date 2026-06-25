// src/labs/student-private-profile/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  executeUpstreamSessionGraphQL,
  isExpiredUpstreamSessionError,
  readUpstreamGraphQLErrorDetail,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export {
  isExpiredUpstreamSessionError,
  readUpstreamGraphQLErrorDetail,
  resolveUpstreamErrorMessage,
};

const STUDENT_PRIVATE_PROFILE_UPSTREAM_SESSION_REQUIRED_ERROR =
  'STUDENT_PRIVATE_PROFILE_UPSTREAM_SESSION_REQUIRED';

export type StudentPrivateProfileCompareField =
  | 'ID_CARD'
  | 'BANK_CARD_NUMBER'
  | 'CARD_NUMBER'
  | 'STUDENT_PHONE'
  | 'CONTACT_PERSON_PHONE';

export type StudentPrivateProfileManualPatchField =
  | StudentPrivateProfileCompareField
  | 'HOME_ADDRESS'
  | 'MAILING_ADDRESS';

export type StudentPrivateProfileManualPatchAction = 'CLEAR' | 'SET';

export type StudentPrivateProfileFamilyMemberPatchField =
  | 'RELATIONSHIP_CODE'
  | 'NAME'
  | 'PHONE'
  | 'WORKPLACE';

export type StudentPrivateProfilePhotoStatus = 'CACHE_RETAINED' | 'INVALID' | 'MISSING' | 'PRESENT';

export type StudentPrivateProfileCompletenessFlags = {
  educationObserved: boolean;
  familyObserved: boolean;
  personalObserved: boolean;
  photoObserved: boolean;
  recordObserved: boolean;
  sensitiveIdentifiersObserved: boolean;
};

export type StudentPrivateProfileClassOverviewAttentionLevel =
  | 'INCOMPLETE'
  | 'MANUAL_OVERRIDE'
  | 'MISSING_SNAPSHOT'
  | 'READY'
  | 'UPSTREAM_ID_MISSING'
  | 'WARNING';

export type StudentPrivateProfileClassOption = {
  authorizationPath: string;
  classCode: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
  resolvedAuthorityCode: string;
  studentCount: number;
};

export type StudentPrivateProfileStudentOption = {
  activeMembershipClassCode: string | null;
  activeMembershipClassName: string | null;
  currentClassCode: string | null;
  currentClassId: string | null;
  lastObservedAt: string | null;
  studentId: string;
  studentName: string | null;
  studentStatus: string;
  upstreamIdPresent: boolean;
};

export type StudentPrivateProfileSummaryField = {
  confidence: string;
  fieldKey: string;
  manualOverrideActive: boolean;
  maskedValue: string | null;
  section: string;
  source: string;
  sourceObservedAt: string;
  upstreamBaselineToken: string | null;
  upstreamChangedSinceManualPatch: boolean;
  valueStatus: string;
};

export type StudentPrivateProfileSummarySectionStatus = {
  observedAt: string;
  section: string;
  sourceEndpoint: string;
  sourceStatus: string;
  warningCodes: string[];
};

export type StudentPrivateProfileSummaryFamilyMember = {
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

export type StudentPrivateProfileSummaryEducationResume = {
  endMonth: string | null;
  itemKey: string;
  maskedOrganization: string | null;
  maskedReference: string | null;
  sourceObservedAt: string;
  sourceUpdatedAt: string | null;
  startMonth: string | null;
  upstreamBaselineToken: string;
};

export type StudentPrivateProfileSummaryRecordChange = {
  changeTime: string | null;
  grade: string | null;
  itemKey: string;
  maskedClassName: string | null;
  maskedMajorName: string | null;
  maskedStudentNumber: string | null;
  sourceObservedAt: string;
  studentNoTypeCode: string | null;
  upstreamBaselineToken: string;
};

export type StudentPrivateProfileSummary = {
  educationResumes: StudentPrivateProfileSummaryEducationResume[];
  familyMembers: StudentPrivateProfileSummaryFamilyMember[];
  fields: StudentPrivateProfileSummaryField[];
  lastManualUpdatedAt: string | null;
  lastSyncedAt: string;
  photo: {
    byteSize: number;
    present: boolean;
    sourceObservedAt: string;
  };
  profileCompletenessFlags: StudentPrivateProfileCompletenessFlags;
  recordChanges: StudentPrivateProfileSummaryRecordChange[];
  sectionStatuses: StudentPrivateProfileSummarySectionStatus[];
  sourceObservedAt: string;
  studentId: string;
};

export type StudentPrivateProfileClassOverviewSectionStatus = {
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

export type StudentPrivateProfileClassOverviewPhoto = {
  byteSize: number;
  present: boolean;
  sourceObservedAt: string;
};

export type StudentPrivateProfileClassOverviewStudent = {
  activeMembershipClassCode: string;
  activeMembershipClassName: string;
  attentionLevel: StudentPrivateProfileClassOverviewAttentionLevel;
  currentClassCode: string | null;
  currentClassId: string | null;
  lastManualUpdatedAt: string | null;
  lastSyncedAt: string | null;
  manualOverrideActive: boolean;
  membershipLastObservedAt: string | null;
  photo: StudentPrivateProfileClassOverviewPhoto | null;
  profileCompletenessFlags: StudentPrivateProfileCompletenessFlags;
  sectionStatuses: StudentPrivateProfileClassOverviewSectionStatus[];
  snapshotPresent: boolean;
  sourceObservedAt: string | null;
  studentId: string;
  studentName: string;
  studentStatus: string;
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

export type StudentPrivateProfileGovernanceReadinessStatus = 'BLOCKED' | 'READY' | 'WARNING';

export type StudentPrivateProfileGovernanceReadinessIssueCode =
  | 'COURSE_RESULT_SNAPSHOT_MISSING'
  | 'EDUCATION_MISSING'
  | 'FAMILY_MISSING'
  | 'MANUAL_OVERRIDE_ACTIVE'
  | 'PERSONAL_MISSING'
  | 'PHOTO_MISSING'
  | 'PRIVATE_PROFILE_SNAPSHOT_MISSING'
  | 'PRIVATE_PROFILE_WARNING'
  | 'RECORD_MISSING'
  | 'SENSITIVE_IDENTIFIERS_MISSING'
  | 'UPSTREAM_CHANGED_SINCE_MANUAL_PATCH'
  | 'UPSTREAM_ID_MISSING';

export type StudentPrivateProfileGovernanceMissingSection =
  | 'courseResult'
  | 'education'
  | 'family'
  | 'personal'
  | 'photo'
  | 'record'
  | 'sensitiveIdentifiers';

export type StudentPrivateProfileGovernanceReadinessStudent = {
  courseResultSnapshotPresent: boolean;
  issueCodes: StudentPrivateProfileGovernanceReadinessIssueCode[];
  manualOverrideActive: boolean;
  missingSections: StudentPrivateProfileGovernanceMissingSection[];
  privateProfileSnapshotPresent: boolean;
  status: StudentPrivateProfileGovernanceReadinessStatus;
  studentId: string;
  studentName: string;
  studentStatus: string;
  upstreamChangedSinceManualPatch: boolean;
  upstreamIdPresent: boolean;
  warningCodes: string[];
};

export type StudentPrivateProfileGovernanceReadinessPreflight = {
  blockedCount: number;
  classCode: string;
  classId: string;
  className: string;
  readyCount: number;
  studentCount: number;
  students: StudentPrivateProfileGovernanceReadinessStudent[];
  warningCount: number;
};

export type StudentPrivateProfilePreviewTemplateCode = 'STUDENT_PRIVATE_PROFILE_PARTIAL_PREVIEW';

export type StudentPrivateProfilePreviewField = {
  confidence: string;
  fieldKey: string;
  label: string;
  manualOverrideActive: boolean;
  section: string;
  source: string;
  sourceObservedAt: string;
  upstreamChangedSinceManualPatch: boolean;
  value: string | null;
  valueStatus: string;
};

export type StudentPrivateProfilePreviewPhoto = {
  byteSize: number;
  present: boolean;
  sourceObservedAt: string;
};

export type StudentPrivateProfilePreviewFamilyMember = {
  fields: StudentPrivateProfilePreviewField[];
  itemKey: string;
  manualOverrideActive: boolean;
  manualPatchFieldKeys: string[];
  sourceObservedAt: string;
  sourceUpdatedAt: string | null;
  upstreamChangedSinceManualPatch: boolean;
};

export type StudentPrivateProfilePreviewEducationResume = {
  fields: StudentPrivateProfilePreviewField[];
  itemKey: string;
  sourceObservedAt: string;
  sourceUpdatedAt: string | null;
};

export type StudentPrivateProfilePreviewRecordChange = {
  fields: StudentPrivateProfilePreviewField[];
  itemKey: string;
  sourceObservedAt: string;
};

export type StudentPrivateProfilePreview = {
  educationResumes: StudentPrivateProfilePreviewEducationResume[];
  familyMembers: StudentPrivateProfilePreviewFamilyMember[];
  fields: StudentPrivateProfilePreviewField[];
  lastManualUpdatedAt: string | null;
  lastSyncedAt: string;
  photo: StudentPrivateProfilePreviewPhoto | null;
  recordChanges: StudentPrivateProfilePreviewRecordChange[];
  sourceObservedAt: string;
  studentId: string;
  templateCode: StudentPrivateProfilePreviewTemplateCode;
  templateVersion: number;
};

export type StudentPrivateProfileRefreshWarning = {
  code: string;
  fieldPath: string | null;
  message: string;
};

export type StudentPrivateProfileRefreshResult = {
  changedSections: string[];
  expiresAt: string | null;
  lastSyncedAt: string;
  photoByteSize: number;
  photoPresent: boolean;
  snapshotUpdated: boolean;
  sourceObservedAt: string;
  studentId: string;
  success: boolean;
  traceId: string;
  upstreamSessionToken: string | null;
  warnings: StudentPrivateProfileRefreshWarning[];
};

export type StudentPrivateProfileBatchRefreshItemStatus = 'FAILED' | 'SUCCESS';

export type StudentPrivateProfileBatchRefreshItem = {
  changedSections: string[];
  errorCode: string | null;
  errorMessage: string | null;
  snapshotUpdated: boolean | null;
  status: StudentPrivateProfileBatchRefreshItemStatus;
  studentId: string;
  warningCodes: string[];
};

export type StudentPrivateProfileBatchRefreshResult = {
  expiresAt: string | null;
  failureCount: number;
  requestedCount: number;
  results: StudentPrivateProfileBatchRefreshItem[];
  success: boolean;
  successCount: number;
  traceId: string;
  upstreamSessionToken: string;
};

export type StudentPrivateProfileCompareResult = {
  results: {
    fieldKey: StudentPrivateProfileCompareField;
    result: 'MATCH' | 'MISMATCH' | 'MISSING';
    valueStatus: 'MISSING' | 'PRESENT';
  }[];
  studentId: string;
};

export type StudentPrivateProfilePhotoReadWarning = {
  code: string;
  message: string;
};

export type StudentPrivateProfilePhotoReadResult = {
  byteSize: number | null;
  expiresAt: string | null;
  height: number | null;
  materializedAt: string | null;
  mimeType: string | null;
  photoBase64: string | null;
  photoStatus: StudentPrivateProfilePhotoStatus;
  source: string | null;
  sourceObservedAt: string | null;
  studentId: string;
  traceId: string;
  upstreamSessionToken: string | null;
  warnings: StudentPrivateProfilePhotoReadWarning[];
  width: number | null;
};

export type PatchStudentPrivateProfileFieldInput = {
  action: StudentPrivateProfileManualPatchAction;
  fieldKey: StudentPrivateProfileManualPatchField;
  upstreamBaselineToken?: string | null;
  value?: string | null;
};

export type PatchStudentPrivateProfileFamilyMemberFieldInput = {
  action: StudentPrivateProfileManualPatchAction;
  fieldKey: StudentPrivateProfileFamilyMemberPatchField;
  value?: string | null;
};

export type PatchStudentPrivateProfileFamilyMemberInput = {
  fields: readonly PatchStudentPrivateProfileFamilyMemberFieldInput[];
  itemKey: string;
  upstreamBaselineToken?: string | null;
};

type StudentPrivateProfileSummaryResponse = {
  studentPrivateProfileSummary: StudentPrivateProfileSummary;
};

type StudentPrivateProfileClassOptionsResponse = {
  studentPrivateProfileClassOptions: StudentPrivateProfileClassOption[];
};

type StudentPrivateProfileClassStudentOptionsResponse = {
  studentPrivateProfileClassStudentOptions: StudentPrivateProfileStudentOption[];
};

type StudentPrivateProfileClassOverviewResponse = {
  studentPrivateProfileClassOverview: StudentPrivateProfileClassOverview;
};

type StudentPrivateProfileGovernanceReadinessPreflightResponse = {
  studentPrivateProfileGovernanceReadinessPreflight: StudentPrivateProfileGovernanceReadinessPreflight;
};

type StudentPrivateProfilePreviewResponse = {
  studentPrivateProfilePreview: StudentPrivateProfilePreview;
};

type RefreshStudentPrivateProfileResponse = {
  refreshStudentPrivateProfileFromUpstream: StudentPrivateProfileRefreshResult;
};

type RefreshStudentPrivateProfilesResponse = {
  refreshStudentPrivateProfilesFromUpstream: StudentPrivateProfileBatchRefreshResult;
};

type CompareStudentPrivateProfileResponse = {
  compareStudentPrivateProfileFields: StudentPrivateProfileCompareResult;
};

type PatchStudentPrivateProfileResponse = {
  patchStudentPrivateProfileFields: StudentPrivateProfileSummary;
};

type ReadStudentPrivateProfilePhotoResponse = {
  readStudentPrivateProfilePhoto: StudentPrivateProfilePhotoReadResult;
};

type PatchStudentPrivateProfileFamilyMembersResponse = {
  patchStudentPrivateProfileFamilyMembers: StudentPrivateProfileSummary;
};

const STUDENT_PRIVATE_PROFILE_SUMMARY_FIELDS = `
  studentId
  sourceObservedAt
  lastSyncedAt
  lastManualUpdatedAt
  fields {
    fieldKey
    section
    maskedValue
    valueStatus
    source
    confidence
    sourceObservedAt
    manualOverrideActive
    upstreamChangedSinceManualPatch
    upstreamBaselineToken
  }
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
  recordChanges {
    itemKey
    upstreamBaselineToken
    changeTime
    studentNoTypeCode
    maskedStudentNumber
    grade
    maskedMajorName
    maskedClassName
    sourceObservedAt
  }
  sectionStatuses {
    section
    sourceStatus
    observedAt
    sourceEndpoint
    warningCodes
  }
  photo {
    present
    byteSize
    sourceObservedAt
  }
  profileCompletenessFlags {
    personalObserved
    sensitiveIdentifiersObserved
    photoObserved
    familyObserved
    educationObserved
    recordObserved
  }
`;

const STUDENT_PRIVATE_PROFILE_SUMMARY_QUERY = `
  query StudentPrivateProfileLabSummary($input: StudentPrivateProfileSummaryInput!) {
    studentPrivateProfileSummary(input: $input) {
      ${STUDENT_PRIVATE_PROFILE_SUMMARY_FIELDS}
    }
  }
`;

const STUDENT_PRIVATE_PROFILE_CLASS_OPTIONS_QUERY = `
  query StudentPrivateProfileLabClassOptions($input: StudentPrivateProfileClassOptionsInput) {
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

const STUDENT_PRIVATE_PROFILE_CLASS_STUDENT_OPTIONS_QUERY = `
  query StudentPrivateProfileLabClassStudentOptions(
    $input: StudentPrivateProfileClassStudentOptionsInput!
  ) {
    studentPrivateProfileClassStudentOptions(input: $input) {
      studentId
      studentName
      studentStatus
      upstreamIdPresent
      currentClassId
      currentClassCode
      activeMembershipClassCode
      activeMembershipClassName
      lastObservedAt
    }
  }
`;

const STUDENT_PRIVATE_PROFILE_CLASS_OVERVIEW_QUERY = `
  query StudentPrivateProfileLabClassOverview($input: StudentPrivateProfileClassOverviewInput!) {
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
        membershipLastObservedAt
        snapshotPresent
        sourceObservedAt
        lastSyncedAt
        lastManualUpdatedAt
        manualOverrideActive
        upstreamChangedSinceManualPatch
        photo {
          present
          byteSize
          sourceObservedAt
        }
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

const STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_PREFLIGHT_QUERY = `
  query StudentPrivateProfileLabGovernanceReadinessPreflight(
    $input: StudentPrivateProfileGovernanceReadinessPreflightInput!
  ) {
    studentPrivateProfileGovernanceReadinessPreflight(input: $input) {
      classId
      classCode
      className
      studentCount
      readyCount
      warningCount
      blockedCount
      students {
        studentId
        studentName
        studentStatus
        upstreamIdPresent
        privateProfileSnapshotPresent
        courseResultSnapshotPresent
        manualOverrideActive
        upstreamChangedSinceManualPatch
        warningCodes
        missingSections
        issueCodes
        status
      }
    }
  }
`;

const STUDENT_PRIVATE_PROFILE_PREVIEW_FIELDS = `
  fieldKey
  label
  section
  value
  valueStatus
  source
  confidence
  sourceObservedAt
  manualOverrideActive
  upstreamChangedSinceManualPatch
`;

const STUDENT_PRIVATE_PROFILE_PREVIEW_QUERY = `
  query StudentPrivateProfileLabPreview($input: StudentPrivateProfilePreviewInput!) {
    studentPrivateProfilePreview(input: $input) {
      studentId
      templateCode
      templateVersion
      sourceObservedAt
      lastSyncedAt
      lastManualUpdatedAt
      fields {
        ${STUDENT_PRIVATE_PROFILE_PREVIEW_FIELDS}
      }
      photo {
        present
        byteSize
        sourceObservedAt
      }
      familyMembers {
        itemKey
        sourceObservedAt
        sourceUpdatedAt
        manualOverrideActive
        upstreamChangedSinceManualPatch
        manualPatchFieldKeys
        fields {
          ${STUDENT_PRIVATE_PROFILE_PREVIEW_FIELDS}
        }
      }
      educationResumes {
        itemKey
        sourceObservedAt
        sourceUpdatedAt
        fields {
          ${STUDENT_PRIVATE_PROFILE_PREVIEW_FIELDS}
        }
      }
      recordChanges {
        itemKey
        sourceObservedAt
        fields {
          ${STUDENT_PRIVATE_PROFILE_PREVIEW_FIELDS}
        }
      }
    }
  }
`;

const REFRESH_STUDENT_PRIVATE_PROFILE_MUTATION = `
  mutation StudentPrivateProfileLabRefresh(
    $input: RefreshStudentPrivateProfileFromUpstreamInput!
  ) {
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

const REFRESH_STUDENT_PRIVATE_PROFILES_MUTATION = `
  mutation StudentPrivateProfileLabBatchRefresh(
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

const COMPARE_STUDENT_PRIVATE_PROFILE_MUTATION = `
  mutation StudentPrivateProfileLabCompare($input: CompareStudentPrivateProfileFieldsInput!) {
    compareStudentPrivateProfileFields(input: $input) {
      studentId
      results {
        fieldKey
        result
        valueStatus
      }
    }
  }
`;

const PATCH_STUDENT_PRIVATE_PROFILE_MUTATION = `
  mutation StudentPrivateProfileLabPatch($input: PatchStudentPrivateProfileFieldsInput!) {
    patchStudentPrivateProfileFields(input: $input) {
      ${STUDENT_PRIVATE_PROFILE_SUMMARY_FIELDS}
    }
  }
`;

const READ_STUDENT_PRIVATE_PROFILE_PHOTO_MUTATION = `
  mutation StudentPrivateProfileLabReadPhoto($input: ReadStudentPrivateProfilePhotoInput!) {
    readStudentPrivateProfilePhoto(input: $input) {
      studentId
      photoStatus
      photoBase64
      mimeType
      byteSize
      width
      height
      source
      sourceObservedAt
      materializedAt
      upstreamSessionToken
      expiresAt
      traceId
      warnings {
        code
        message
      }
    }
  }
`;

const PATCH_STUDENT_PRIVATE_PROFILE_FAMILY_MEMBERS_MUTATION = `
  mutation StudentPrivateProfileLabPatchFamily(
    $input: PatchStudentPrivateProfileFamilyMembersInput!
  ) {
    patchStudentPrivateProfileFamilyMembers(input: $input) {
      ${STUDENT_PRIVATE_PROFILE_SUMMARY_FIELDS}
    }
  }
`;

function compactInput<TValue extends Record<string, unknown>>(input: TValue) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<TValue>;
}

export function normalizeStudentPrivateProfileStudentId(studentId: string | null | undefined) {
  return normalizeRequiredTextValue(studentId, {
    label: '本地学生 ID',
  });
}

export function normalizeBatchRefreshStudentIds(
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
      throw new Error('本地学生 ID 不能超过 32 个字符。');
    }

    if (observedStudentIds.has(normalizedStudentId)) {
      return;
    }

    observedStudentIds.add(normalizedStudentId);
    studentIds.push(normalizedStudentId);
  });

  if (studentIds.length === 0) {
    throw new Error('请选择或输入至少 1 个本地学生 ID。');
  }

  if (studentIds.length > 20) {
    throw new Error('一次最多刷新 20 个学生。');
  }

  return studentIds;
}

export function normalizeBatchRefreshInput(input: {
  studentIds: readonly (string | null | undefined)[];
  upstreamSessionToken: string | null | undefined;
}) {
  const studentIds = normalizeBatchRefreshStudentIds(input.studentIds);
  const upstreamSessionToken = normalizeRequiredTextValue(input.upstreamSessionToken, {
    label: 'upstream session token',
  });

  if (upstreamSessionToken.length > 4096) {
    throw new Error('upstream session token 不能超过 4096 个字符。');
  }

  return {
    studentIds,
    upstreamSessionToken,
  };
}

export function isStudentPrivateProfileUpstreamSessionRequiredError(error: unknown) {
  const detail = readUpstreamGraphQLErrorDetail(error);

  return (
    detail?.code === STUDENT_PRIVATE_PROFILE_UPSTREAM_SESSION_REQUIRED_ERROR ||
    detail?.errorCode === STUDENT_PRIVATE_PROFILE_UPSTREAM_SESSION_REQUIRED_ERROR
  );
}

export function normalizeListClassStudentOptionsInput(input: {
  classId: string | null | undefined;
}) {
  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级 ID' }),
  };
}

export function normalizeStudentPrivateProfileClassOverviewInput(input: {
  classId: string | null | undefined;
}) {
  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级 ID' }),
  };
}

export function normalizeStudentPrivateProfileGovernanceReadinessPreflightInput(input: {
  classId: string | null | undefined;
}) {
  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级 ID' }),
  };
}

export function normalizeStudentPrivateProfilePreviewInput(input: {
  studentId: string | null | undefined;
  templateCode: StudentPrivateProfilePreviewTemplateCode;
}) {
  return {
    studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
    templateCode: normalizeRequiredTextValue(input.templateCode, {
      label: '预览模板',
    }) as StudentPrivateProfilePreviewTemplateCode,
  };
}

export function normalizeCompareStudentPrivateProfileFieldsInput(input: {
  fields: readonly {
    candidateValue: string | null | undefined;
    fieldKey: StudentPrivateProfileCompareField;
  }[];
  studentId: string | null | undefined;
}) {
  return {
    fields: input.fields.map((field) => ({
      candidateValue: normalizeRequiredTextValue(field.candidateValue, {
        label: '候选值',
      }),
      fieldKey: field.fieldKey,
    })),
    studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
  };
}

export function normalizePatchStudentPrivateProfileFieldsInput(input: {
  fields: readonly PatchStudentPrivateProfileFieldInput[];
  studentId: string | null | undefined;
}) {
  return {
    fields: input.fields.map((field) => {
      if (field.action === 'CLEAR') {
        return {
          action: field.action,
          fieldKey: field.fieldKey,
        };
      }

      return compactInput({
        action: field.action,
        fieldKey: field.fieldKey,
        upstreamBaselineToken: normalizeRequiredTextValue(field.upstreamBaselineToken, {
          label: 'baseline token',
        }),
        value: normalizeRequiredTextValue(field.value, {
          label: '修正值',
        }),
      });
    }),
    studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
  };
}

export function normalizeReadStudentPrivateProfilePhotoInput(input: {
  forceRefresh?: boolean | null;
  studentId: string | null | undefined;
  upstreamSessionToken?: string | null;
}) {
  return {
    input: compactInput({
      forceRefresh: Boolean(input.forceRefresh),
      studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
      upstreamSessionToken: normalizeOptionalTextValue(input.upstreamSessionToken, 'to_undefined'),
    }),
  };
}

export function normalizePatchStudentPrivateProfileFamilyMembersInput(input: {
  members: readonly PatchStudentPrivateProfileFamilyMemberInput[];
  studentId: string | null | undefined;
}) {
  return {
    members: input.members.map((member) => {
      const hasSetAction = member.fields.some((field) => field.action === 'SET');

      return compactInput({
        fields: member.fields.map((field) => {
          if (field.action === 'CLEAR') {
            return {
              action: field.action,
              fieldKey: field.fieldKey,
            };
          }

          return {
            action: field.action,
            fieldKey: field.fieldKey,
            value: normalizeRequiredTextValue(field.value, {
              label: '家庭成员修正值',
            }),
          };
        }),
        itemKey: normalizeRequiredTextValue(member.itemKey, {
          label: '家庭成员行标识',
        }),
        upstreamBaselineToken: hasSetAction
          ? normalizeRequiredTextValue(member.upstreamBaselineToken, {
              label: '家庭成员 baseline token',
            })
          : undefined,
      });
    }),
    studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
  };
}

export async function getStudentPrivateProfileSummary(input: {
  studentId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    StudentPrivateProfileSummaryResponse,
    OperationVariables & {
      input: {
        studentId: string;
      };
    }
  >(STUDENT_PRIVATE_PROFILE_SUMMARY_QUERY, {
    input: {
      studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
    },
  });

  return response.studentPrivateProfileSummary;
}

export async function listStudentPrivateProfileClassOptions() {
  const response = await executeGraphQL<
    StudentPrivateProfileClassOptionsResponse,
    OperationVariables & {
      input: Record<string, never>;
    }
  >(STUDENT_PRIVATE_PROFILE_CLASS_OPTIONS_QUERY, { input: {} });

  return response.studentPrivateProfileClassOptions;
}

export async function listStudentPrivateProfileClassStudentOptions(input: {
  classId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    StudentPrivateProfileClassStudentOptionsResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeListClassStudentOptionsInput>;
    }
  >(STUDENT_PRIVATE_PROFILE_CLASS_STUDENT_OPTIONS_QUERY, {
    input: normalizeListClassStudentOptionsInput(input),
  });

  return [...response.studentPrivateProfileClassStudentOptions].sort((left, right) =>
    left.studentId.localeCompare(right.studentId),
  );
}

export async function getStudentPrivateProfileClassOverview(input: {
  classId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    StudentPrivateProfileClassOverviewResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentPrivateProfileClassOverviewInput>;
    }
  >(STUDENT_PRIVATE_PROFILE_CLASS_OVERVIEW_QUERY, {
    input: normalizeStudentPrivateProfileClassOverviewInput(input),
  });

  return response.studentPrivateProfileClassOverview;
}

export async function getStudentPrivateProfileGovernanceReadinessPreflight(input: {
  classId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    StudentPrivateProfileGovernanceReadinessPreflightResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentPrivateProfileGovernanceReadinessPreflightInput>;
    }
  >(STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_PREFLIGHT_QUERY, {
    input: normalizeStudentPrivateProfileGovernanceReadinessPreflightInput(input),
  });

  return response.studentPrivateProfileGovernanceReadinessPreflight;
}

export async function getStudentPrivateProfilePreview(input: {
  studentId: string | null | undefined;
  templateCode?: StudentPrivateProfilePreviewTemplateCode;
}) {
  const response = await executeGraphQL<
    StudentPrivateProfilePreviewResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentPrivateProfilePreviewInput>;
    }
  >(STUDENT_PRIVATE_PROFILE_PREVIEW_QUERY, {
    input: normalizeStudentPrivateProfilePreviewInput({
      studentId: input.studentId,
      templateCode: input.templateCode ?? 'STUDENT_PRIVATE_PROFILE_PARTIAL_PREVIEW',
    }),
  });

  return response.studentPrivateProfilePreview;
}

export async function refreshStudentPrivateProfileFromUpstream(input: {
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  const response = await executeUpstreamSessionGraphQL<
    RefreshStudentPrivateProfileResponse,
    OperationVariables & {
      input: {
        studentId: string;
        upstreamSessionToken: string;
      };
    }
  >(REFRESH_STUDENT_PRIVATE_PROFILE_MUTATION, {
    input: {
      studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
      upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
        label: 'upstream session token',
      }),
    },
  });

  return response.refreshStudentPrivateProfileFromUpstream;
}

export async function refreshStudentPrivateProfilesFromUpstream(input: {
  studentIds: readonly (string | null | undefined)[];
  upstreamSessionToken: string | null | undefined;
}) {
  const response = await executeUpstreamSessionGraphQL<
    RefreshStudentPrivateProfilesResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeBatchRefreshInput>;
    }
  >(REFRESH_STUDENT_PRIVATE_PROFILES_MUTATION, {
    input: normalizeBatchRefreshInput(input),
  });

  return response.refreshStudentPrivateProfilesFromUpstream;
}

export async function compareStudentPrivateProfileFields(input: {
  fields: readonly {
    candidateValue: string | null | undefined;
    fieldKey: StudentPrivateProfileCompareField;
  }[];
  studentId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    CompareStudentPrivateProfileResponse,
    OperationVariables & ReturnType<typeof normalizeCompareStudentPrivateProfileFieldsInput>
  >(COMPARE_STUDENT_PRIVATE_PROFILE_MUTATION, {
    input: normalizeCompareStudentPrivateProfileFieldsInput(input),
  });

  return response.compareStudentPrivateProfileFields;
}

export async function patchStudentPrivateProfileFields(input: {
  fields: readonly PatchStudentPrivateProfileFieldInput[];
  studentId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    PatchStudentPrivateProfileResponse,
    OperationVariables & ReturnType<typeof normalizePatchStudentPrivateProfileFieldsInput>
  >(PATCH_STUDENT_PRIVATE_PROFILE_MUTATION, {
    input: normalizePatchStudentPrivateProfileFieldsInput(input),
  });

  return response.patchStudentPrivateProfileFields;
}

export async function readStudentPrivateProfilePhoto(input: {
  forceRefresh?: boolean | null;
  studentId: string | null | undefined;
  upstreamSessionToken?: string | null;
}) {
  const response = await executeUpstreamSessionGraphQL<
    ReadStudentPrivateProfilePhotoResponse,
    OperationVariables & ReturnType<typeof normalizeReadStudentPrivateProfilePhotoInput>
  >(
    READ_STUDENT_PRIVATE_PROFILE_PHOTO_MUTATION,
    normalizeReadStudentPrivateProfilePhotoInput(input),
  );

  return response.readStudentPrivateProfilePhoto;
}

export async function patchStudentPrivateProfileFamilyMembers(input: {
  members: readonly PatchStudentPrivateProfileFamilyMemberInput[];
  studentId: string | null | undefined;
}) {
  const response = await executeGraphQL<
    PatchStudentPrivateProfileFamilyMembersResponse,
    OperationVariables & ReturnType<typeof normalizePatchStudentPrivateProfileFamilyMembersInput>
  >(PATCH_STUDENT_PRIVATE_PROFILE_FAMILY_MEMBERS_MUTATION, {
    input: normalizePatchStudentPrivateProfileFamilyMembersInput(input),
  });

  return response.patchStudentPrivateProfileFamilyMembers;
}
