// src/labs/student-private-profile/api.ts

import type { OperationVariables } from '@apollo/client';
import type { Workbook, Worksheet } from 'exceljs';

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
import { executeGraphQL, getGraphQLEndpoint, getGraphQLRuntimeConfig } from '@/shared/graphql';

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
  sectionBaselineToken: string | null;
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

export type StudentPrivateProfileWriteThroughAction = 'CREATE' | 'DELETE';

export type StudentPrivateProfileSupplementTemplateCode =
  | 'STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT'
  | 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT';

export type StudentPrivateProfileSupplementTemplateColumn = {
  alwaysRequired: boolean;
  enumValues: string[];
  fieldKey: string | null;
  key: string;
  label: string;
  requiredForActions: StudentPrivateProfileWriteThroughAction[];
  sensitive: boolean;
  valueType: 'DATE' | 'ENUM' | 'STRING' | string;
};

export type StudentPrivateProfileSupplementTemplate = {
  actions: StudentPrivateProfileWriteThroughAction[];
  columns: StudentPrivateProfileSupplementTemplateColumn[];
  sectionKey: 'EDUCATION_RESUME' | 'FAMILY' | string;
  templateCode: StudentPrivateProfileSupplementTemplateCode;
  templateVersion: number;
};

export type StudentPrivateProfileSupplementUploadResult = {
  byteSize: number;
  expiresAt: string;
  fileToken: string;
  originalFilename: string;
};

export type StudentPrivateProfileSupplementDryRunStatus = 'BLOCKED' | 'READY' | string;
export type StudentPrivateProfileSupplementDryRunRowStatus =
  | 'INVALID'
  | 'SKIPPED'
  | 'VALID'
  | string;

export type StudentPrivateProfileSupplementDryRunRowIssue = {
  code: string;
  columnKey: string | null;
};

export type StudentPrivateProfileSupplementDryRunRow = {
  action: StudentPrivateProfileWriteThroughAction | null;
  errorCodes: string[];
  issues: StudentPrivateProfileSupplementDryRunRowIssue[];
  rowNumber: number;
  status: StudentPrivateProfileSupplementDryRunRowStatus;
  studentId: string | null;
  warningCodes: string[];
};

export type StudentPrivateProfileSupplementDryRunResult = {
  affectedStudents: number;
  dryRun: boolean;
  invalidRows: number;
  rowResults: StudentPrivateProfileSupplementDryRunRow[];
  sectionKey: 'EDUCATION_RESUME' | 'FAMILY' | string;
  status: StudentPrivateProfileSupplementDryRunStatus;
  templateCode: StudentPrivateProfileSupplementTemplateCode;
  templateVersion: number;
  totalRows: number;
  validRows: number;
};

export type StudentPrivateProfileSupplementTemplateWorkbookRow = Record<string, string>;

export type WriteStudentPrivateProfileFamilyMemberToUpstreamInput = {
  action: StudentPrivateProfileWriteThroughAction;
  itemKey?: string | null;
  name?: string | null;
  phone?: string | null;
  relationshipCode?: string | null;
  upstreamBaselineToken?: string | null;
  workplace?: string | null;
};

export type WriteStudentPrivateProfileEducationResumeToUpstreamInput = {
  action: StudentPrivateProfileWriteThroughAction;
  endDate?: string | null;
  itemKey?: string | null;
  organization?: string | null;
  reference?: string | null;
  startDate?: string | null;
  upstreamBaselineToken?: string | null;
};

export type WriteStudentPrivateProfileSectionToUpstreamResult = {
  action: StudentPrivateProfileWriteThroughAction;
  changedSections: string[];
  expiresAt: string | null;
  localSnapshotRefreshed: boolean;
  sectionKey: 'EDUCATION_RESUME' | 'FAMILY';
  snapshotUpdated: boolean;
  sourceObservedAt: string;
  studentId: string;
  success: boolean;
  summary: StudentPrivateProfileSummary | null;
  summaryRefreshFailed: boolean;
  traceId: string;
  upstreamSaved: boolean;
  upstreamSessionToken: string | null;
  warningCodes: string[];
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

type StudentPrivateProfileSupplementTemplateResponse = {
  studentPrivateProfileSupplementTemplate: StudentPrivateProfileSupplementTemplate;
};

type StudentPrivateProfileSupplementDryRunResponse = {
  studentPrivateProfileSupplementDryRun: StudentPrivateProfileSupplementDryRunResult;
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

type WriteStudentPrivateProfileFamilyToUpstreamResponse = {
  writeStudentPrivateProfileFamilyToUpstream: WriteStudentPrivateProfileSectionToUpstreamResult;
};

type WriteStudentPrivateProfileEducationToUpstreamResponse = {
  writeStudentPrivateProfileEducationToUpstream: WriteStudentPrivateProfileSectionToUpstreamResult;
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
    sectionBaselineToken
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

const STUDENT_PRIVATE_PROFILE_SUPPLEMENT_TEMPLATE_QUERY = `
  query StudentPrivateProfileLabSupplementTemplate(
    $input: StudentPrivateProfileSupplementTemplateInput!
  ) {
    studentPrivateProfileSupplementTemplate(input: $input) {
      templateCode
      templateVersion
      sectionKey
      actions
      columns {
        key
        label
        alwaysRequired
        requiredForActions
        valueType
        sensitive
        fieldKey
        enumValues
      }
    }
  }
`;

const STUDENT_PRIVATE_PROFILE_SUPPLEMENT_DRY_RUN_MUTATION = `
  mutation StudentPrivateProfileLabSupplementDryRun(
    $input: StudentPrivateProfileSupplementDryRunInput!
  ) {
    studentPrivateProfileSupplementDryRun(input: $input) {
      templateCode
      templateVersion
      sectionKey
      dryRun
      status
      totalRows
      validRows
      invalidRows
      affectedStudents
      rowResults {
        rowNumber
        studentId
        action
        status
        errorCodes
        warningCodes
        issues {
          code
          columnKey
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

const STUDENT_PRIVATE_PROFILE_WRITE_THROUGH_RESULT_FIELDS = `
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
  summary {
    ${STUDENT_PRIVATE_PROFILE_SUMMARY_FIELDS}
  }
`;

const WRITE_STUDENT_PRIVATE_PROFILE_FAMILY_TO_UPSTREAM_MUTATION = `
  mutation StudentPrivateProfileLabWriteFamilyToUpstream(
    $input: WriteStudentPrivateProfileFamilyToUpstreamInput!
  ) {
    writeStudentPrivateProfileFamilyToUpstream(input: $input) {
      ${STUDENT_PRIVATE_PROFILE_WRITE_THROUGH_RESULT_FIELDS}
    }
  }
`;

const WRITE_STUDENT_PRIVATE_PROFILE_EDUCATION_TO_UPSTREAM_MUTATION = `
  mutation StudentPrivateProfileLabWriteEducationToUpstream(
    $input: WriteStudentPrivateProfileEducationToUpstreamInput!
  ) {
    writeStudentPrivateProfileEducationToUpstream(input: $input) {
      ${STUDENT_PRIVATE_PROFILE_WRITE_THROUGH_RESULT_FIELDS}
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

export function normalizeStudentPrivateProfileSupplementTemplateInput(input: {
  templateCode: StudentPrivateProfileSupplementTemplateCode | null | undefined;
}) {
  return {
    templateCode: normalizeRequiredTextValue(input.templateCode, {
      label: '补录模板',
    }) as StudentPrivateProfileSupplementTemplateCode,
  };
}

export function normalizeStudentPrivateProfileSupplementDryRunInput(input: {
  fileToken: string | null | undefined;
  templateCode: StudentPrivateProfileSupplementTemplateCode | null | undefined;
  templateVersion: number | null | undefined;
}) {
  const templateVersion = input.templateVersion;

  if (!Number.isInteger(templateVersion) || !templateVersion || templateVersion < 1) {
    throw new Error('补录模板版本必须是大于 0 的整数。');
  }

  return {
    fileToken: normalizeRequiredTextValue(input.fileToken, { label: '补录文件 token' }),
    templateCode: normalizeRequiredTextValue(input.templateCode, {
      label: '补录模板',
    }) as StudentPrivateProfileSupplementTemplateCode,
    templateVersion,
  };
}

const STUDENT_PRIVATE_PROFILE_FAMILY_RELATIONSHIP_CODES = new Set(['1', '2', '3', '4']);
const STUDENT_PRIVATE_PROFILE_WRITE_THROUGH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STUDENT_PRIVATE_PROFILE_SUPPLEMENT_FILE_MAX_BYTES = 5 * 1024 * 1024;
const STUDENT_PRIVATE_PROFILE_SUPPLEMENT_OPAQUE_COLUMN_KEYS = new Set([
  'action',
  'expectedSectionBaselineToken',
  'itemKey',
  'upstreamBaselineToken',
]);
const STUDENT_PRIVATE_PROFILE_SUPPLEMENT_TEMPLATE_FILL_ROW_COUNT = 100;
const STUDENT_PRIVATE_PROFILE_SUPPLEMENT_UPLOAD_PATH = '/student-private-profile/supplement-files';
const STUDENT_PRIVATE_PROFILE_FAMILY_RELATIONSHIP_CODE_LABELS: Record<string, string> = {
  '1': '父亲',
  '2': '母亲',
  '3': '祖父母',
  '4': '兄弟姐妹',
};

function normalizeUpstreamSessionToken(upstreamSessionToken: string | null | undefined) {
  const normalizedToken = normalizeRequiredTextValue(upstreamSessionToken, {
    label: 'upstream session token',
  });

  if (normalizedToken.length > 4096) {
    throw new Error('upstream session token 不能超过 4096 个字符。');
  }

  return normalizedToken;
}

function normalizeSectionBaselineToken(expectedSectionBaselineToken: string | null | undefined) {
  return normalizeRequiredTextValue(expectedSectionBaselineToken, {
    label: 'section baseline token',
  });
}

function normalizeWriteThroughAction(action: StudentPrivateProfileWriteThroughAction) {
  if (action !== 'CREATE' && action !== 'DELETE') {
    throw new Error('写回动作不支持。');
  }

  return action;
}

function normalizeFamilyRelationshipCode(relationshipCode: string | null | undefined) {
  const normalizedCode = normalizeRequiredTextValue(relationshipCode, {
    label: '家庭关系',
  });

  if (!STUDENT_PRIVATE_PROFILE_FAMILY_RELATIONSHIP_CODES.has(normalizedCode)) {
    throw new Error('家庭关系当前只支持 1 / 2 / 3 / 4。');
  }

  return normalizedCode;
}

function normalizeWriteThroughDate(value: string | null | undefined, label: string) {
  const normalizedDate = normalizeRequiredTextValue(value, { label });
  const date = new Date(`${normalizedDate}T00:00:00.000Z`);

  if (
    !STUDENT_PRIVATE_PROFILE_WRITE_THROUGH_DATE_PATTERN.test(normalizedDate) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalizedDate
  ) {
    throw new Error(`${label}必须是合法日期，格式为 YYYY-MM-DD。`);
  }

  return normalizedDate;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readRestEnvelopeMessage(payload: unknown) {
  if (!isRecordValue(payload)) {
    return null;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  const error = payload.error;

  if (isRecordValue(error) && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return null;
}

function assertSupplementUploadResult(value: unknown): StudentPrivateProfileSupplementUploadResult {
  if (
    !isRecordValue(value) ||
    typeof value.fileToken !== 'string' ||
    typeof value.expiresAt !== 'string' ||
    typeof value.originalFilename !== 'string' ||
    typeof value.byteSize !== 'number'
  ) {
    throw new Error('补录文件上传返回结果异常。');
  }

  return {
    byteSize: value.byteSize,
    expiresAt: value.expiresAt,
    fileToken: value.fileToken,
    originalFilename: value.originalFilename,
  };
}

async function parseSupplementUploadResponse(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error('补录文件上传返回结果异常。');
  }

  if (!response.ok) {
    throw new Error(readRestEnvelopeMessage(payload) ?? '补录文件上传失败。');
  }

  if (!isRecordValue(payload) || payload.success !== true) {
    throw new Error(readRestEnvelopeMessage(payload) ?? '补录文件上传失败。');
  }

  return assertSupplementUploadResult(payload.data);
}

function createSupplementUploadFormData(file: File) {
  const formData = new FormData();

  formData.append('file', file);

  return formData;
}

function buildSupplementUploadAuthorizationHeaders() {
  const accessToken = getGraphQLRuntimeConfig().getAccessToken?.() ?? null;

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

function normalizeSupplementTemplateWorkbookRow(
  template: StudentPrivateProfileSupplementTemplate,
  values: Record<string, string | null | undefined>,
): StudentPrivateProfileSupplementTemplateWorkbookRow {
  return Object.fromEntries(
    template.columns.map((column) => [column.key, values[column.key]?.trim() ?? '']),
  );
}

export function buildStudentPrivateProfileSupplementTemplateWorkbookColumns(
  columns: readonly StudentPrivateProfileSupplementTemplateColumn[],
) {
  return columns.map((column) => ({
    header: column.label,
    hidden: STUDENT_PRIVATE_PROFILE_SUPPLEMENT_OPAQUE_COLUMN_KEYS.has(column.key),
    key: column.key,
    width: Math.min(Math.max(column.label.length + 4, column.key.length + 4, 14), 36),
  }));
}

function resolveSupplementSummarySectionBaselineToken(
  summary: StudentPrivateProfileSummary,
  templateCode: StudentPrivateProfileSupplementTemplateCode,
) {
  const section =
    templateCode === 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT' ? 'family' : 'education';

  return (
    summary.sectionStatuses.find((sectionStatus) => sectionStatus.section === section)
      ?.sectionBaselineToken ?? null
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getExcelColumnName(columnNumber: number) {
  let value = columnNumber;
  let columnName = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;

    columnName = String.fromCharCode(65 + remainder) + columnName;
    value = Math.floor((value - remainder - 1) / 26);
  }

  return columnName;
}

function sanitizeSupplementWorksheetName(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/[\][*?:/\\]/g, '_') ?? '';

  return normalizedValue.slice(0, 20);
}

function buildSupplementWorksheetName(studentName: string | null | undefined) {
  const normalizedStudentName = sanitizeSupplementWorksheetName(studentName);

  return normalizedStudentName ? `${normalizedStudentName}_supplement`.slice(0, 31) : 'supplement';
}

function getSupplementTemplateColumnNote(column: StudentPrivateProfileSupplementTemplateColumn) {
  if (column.key === 'action') {
    return '从下拉中选择：CREATE 表示新增，DELETE 表示删除。';
  }

  if (column.key === 'relationshipCode') {
    return '家庭关系 code：1=父亲，2=母亲，3=祖父母，4=兄弟姐妹。';
  }

  if (column.valueType === 'DATE') {
    return '日期格式必须为 YYYY-MM-DD。';
  }

  if (STUDENT_PRIVATE_PROFILE_SUPPLEMENT_OPAQUE_COLUMN_KEYS.has(column.key)) {
    return '系统预填的校验 token，请不要修改。';
  }

  return column.label;
}

function getSupplementTemplateColumnEnumValues(
  column: StudentPrivateProfileSupplementTemplateColumn,
) {
  if (column.enumValues.length > 0) {
    return column.enumValues;
  }

  if (column.key === 'action') {
    return ['CREATE', 'DELETE'];
  }

  return [];
}

function applySupplementTemplateWorksheetPolicy(input: {
  columns: readonly StudentPrivateProfileSupplementTemplateColumn[];
  isFamilyTemplate: boolean;
  rowCount: number;
  worksheet: Worksheet;
}) {
  const headerRow = input.worksheet.getRow(1);

  headerRow.font = { bold: true };
  input.worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  input.columns.forEach((column, index) => {
    const columnNumber = index + 1;
    const headerCell = headerRow.getCell(columnNumber);
    const enumValues =
      input.isFamilyTemplate && column.key === 'relationshipCode'
        ? []
        : getSupplementTemplateColumnEnumValues(column);

    headerCell.note = getSupplementTemplateColumnNote(column);
    input.worksheet.getColumn(columnNumber).hidden =
      STUDENT_PRIVATE_PROFILE_SUPPLEMENT_OPAQUE_COLUMN_KEYS.has(column.key);

    if (enumValues.length === 0) {
      return;
    }

    const columnName = getExcelColumnName(columnNumber);

    for (let rowNumber = 2; rowNumber <= input.rowCount + 1; rowNumber += 1) {
      input.worksheet.getCell(`${columnName}${rowNumber}`).dataValidation = {
        allowBlank: !column.alwaysRequired,
        error: '请从下拉列表中选择允许的值。',
        errorStyle: 'error',
        errorTitle: '非法选项',
        formulae: [`"${enumValues.join(',')}"`],
        showErrorMessage: true,
        type: 'list',
      };
    }
  });
}

function applyFamilyRelationshipDisplay(input: {
  columns: readonly StudentPrivateProfileSupplementTemplateColumn[];
  rowCount: number;
  worksheet: Worksheet;
}) {
  const relationshipColumnIndex = input.columns.findIndex(
    (column) => column.key === 'relationshipCode',
  );

  if (relationshipColumnIndex < 0) {
    return;
  }

  const columnName = getExcelColumnName(relationshipColumnIndex + 1);

  input.worksheet.getColumn(relationshipColumnIndex + 1).numFmt = '[=1]"父亲";[=2]"母亲";General';

  for (let rowNumber = 2; rowNumber <= input.rowCount + 1; rowNumber += 1) {
    const cell = input.worksheet.getCell(`${columnName}${rowNumber}`);

    if (cell.value === '1') {
      cell.value = 1;
    } else if (cell.value === '2') {
      cell.value = 2;
    }
  }
}

function addSupplementTemplateInstructionWorksheet(input: {
  template: StudentPrivateProfileSupplementTemplate;
  workbook: Workbook;
}) {
  const worksheet = input.workbook.addWorksheet('说明');

  worksheet.columns = [{ key: 'text', width: 92 }];
  worksheet.addRows([
    { text: '只上传第一个 supplement 工作表；后端 dry-run 只读取第一个工作表。' },
    { text: '表头必须保持当前模板列名，不要改名、删列或调整顺序。' },
    { text: '隐藏列是系统预填的 CAS token，用于防止基于旧快照补录，请不要手动修改。' },
    { text: 'studentName 是只读辅助列，用于人工核对姓名，后端 dry-run 不做业务校验。' },
    { text: 'action 等枚举列已设置下拉，请从下拉中选择。' },
    { text: 'P5 只做 dry-run 校验，不会写回学工系统，也不会写本地业务数据。' },
  ]);
  worksheet.getRow(1).font = { bold: true };

  if (input.template.templateCode === 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT') {
    worksheet.addRow({
      text: 'relationshipCode：1=父亲，2=母亲，3=祖父母，4=兄弟姐妹。',
    });
  }
}

function addSupplementStudentReferenceWorksheet(input: {
  studentId: string | null;
  studentName: string | null | undefined;
  workbook: Workbook;
}) {
  if (!input.studentId || !input.studentName?.trim()) {
    return;
  }

  const worksheet = input.workbook.addWorksheet('student_reference');

  worksheet.columns = [
    { header: 'studentId', key: 'studentId', width: 18 },
    { header: 'studentName', key: 'studentName', width: 20 },
  ];
  worksheet.addRow({
    studentId: input.studentId,
    studentName: input.studentName.trim(),
  });
  worksheet.getRow(1).font = { bold: true };
}

function applySupplementStudentNameNotes(input: {
  studentName: string | null | undefined;
  worksheet: Worksheet;
}) {
  const normalizedStudentName = input.studentName?.trim();

  if (!normalizedStudentName) {
    return;
  }

  const studentIdColumnNumber = input.worksheet.columns.findIndex(
    (column) => column.key === 'studentId',
  );

  if (studentIdColumnNumber < 0) {
    return;
  }

  input.worksheet.getCell(`${getExcelColumnName(studentIdColumnNumber + 1)}2`).note =
    `学生姓名：${normalizedStudentName}`;
  input.worksheet.getCell(`${getExcelColumnName(studentIdColumnNumber + 1)}2`).dataValidation = {
    prompt: `学生姓名：${normalizedStudentName}`,
    promptTitle: '当前学生',
    showInputMessage: true,
    type: 'textLength',
  };
}

function buildSupplementDeleteCandidateRows(input: {
  summary: StudentPrivateProfileSummary | null;
  studentName?: string | null;
  template: StudentPrivateProfileSupplementTemplate;
}) {
  if (!input.summary) {
    return [];
  }

  const sectionBaselineToken = resolveSupplementSummarySectionBaselineToken(
    input.summary,
    input.template.templateCode,
  );

  if (!sectionBaselineToken) {
    return [];
  }

  const baseValues = {
    expectedSectionBaselineToken: sectionBaselineToken,
    studentId: input.summary.studentId,
    studentName: input.studentName,
  };

  if (input.template.templateCode === 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT') {
    return input.summary.familyMembers.map((member) => ({
      ...normalizeSupplementTemplateWorkbookRow(input.template, {
        ...baseValues,
        action: 'DELETE',
        itemKey: member.itemKey,
        relationshipCode: member.relationshipCode,
        upstreamBaselineToken: member.upstreamBaselineToken,
      }),
      _reference: [
        STUDENT_PRIVATE_PROFILE_FAMILY_RELATIONSHIP_CODE_LABELS[member.relationshipCode] ??
          member.relationshipCode,
        member.maskedName,
        member.maskedPhone,
        member.maskedWorkplace,
      ]
        .filter(Boolean)
        .join(' / '),
    }));
  }

  return input.summary.educationResumes.map((resume) => ({
    ...normalizeSupplementTemplateWorkbookRow(input.template, {
      ...baseValues,
      action: 'DELETE',
      endDate: resume.endMonth ? `${resume.endMonth}-01` : null,
      itemKey: resume.itemKey,
      startDate: resume.startMonth ? `${resume.startMonth}-01` : null,
      upstreamBaselineToken: resume.upstreamBaselineToken,
    }),
    _reference:
      [resume.startMonth, resume.endMonth, resume.maskedReference, resume.maskedOrganization]
        .filter(Boolean)
        .join(' / ') || '当前教育经历',
  }));
}

function assertSingleWriteThroughItem<TItem>(
  items: readonly TItem[],
  label: string,
): asserts items is readonly [TItem] {
  if (items.length !== 1) {
    throw new Error(`P4.1 每次只允许写回 1 ${label}。`);
  }
}

export function resolveStudentPrivateProfileSupplementUploadUrl(
  graphQLEndpoint = getGraphQLEndpoint(),
) {
  return new URL(STUDENT_PRIVATE_PROFILE_SUPPLEMENT_UPLOAD_PATH, graphQLEndpoint).toString();
}

export function normalizeStudentPrivateProfileSupplementFile(file: File | null | undefined) {
  if (!file) {
    throw new Error('请选择要上传的 .xlsx 文件。');
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('补录文件只支持 .xlsx 格式。');
  }

  if (file.size > STUDENT_PRIVATE_PROFILE_SUPPLEMENT_FILE_MAX_BYTES) {
    throw new Error('补录文件不能超过 5MB。');
  }

  return file;
}

export function buildStudentPrivateProfileSupplementTemplateWorkbookRows(input: {
  summary: StudentPrivateProfileSummary | null;
  studentName?: string | null;
  template: StudentPrivateProfileSupplementTemplate;
}): StudentPrivateProfileSupplementTemplateWorkbookRow[] {
  if (!input.summary) {
    return [];
  }

  const sectionBaselineToken = resolveSupplementSummarySectionBaselineToken(
    input.summary,
    input.template.templateCode,
  );

  if (!sectionBaselineToken) {
    return [];
  }

  const baseValues = {
    expectedSectionBaselineToken: sectionBaselineToken,
    studentId: input.summary.studentId,
    studentName: input.studentName,
  };

  if (input.template.templateCode === 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT') {
    return [
      normalizeSupplementTemplateWorkbookRow(input.template, {
        ...baseValues,
        action: 'CREATE',
        relationshipCode: '1',
      }),
      normalizeSupplementTemplateWorkbookRow(input.template, {
        ...baseValues,
        action: 'CREATE',
        relationshipCode: '2',
      }),
    ];
  }

  return [
    normalizeSupplementTemplateWorkbookRow(input.template, {
      ...baseValues,
      action: 'CREATE',
    }),
  ];
}

export function buildStudentPrivateProfileSupplementTemplateFileName(
  template: StudentPrivateProfileSupplementTemplate,
) {
  return template.templateCode === 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT'
    ? `student-private-profile-family-supplement-v${template.templateVersion}.xlsx`
    : `student-private-profile-education-supplement-v${template.templateVersion}.xlsx`;
}

export async function downloadStudentPrivateProfileSupplementTemplateWorkbook(input: {
  summary: StudentPrivateProfileSummary | null;
  studentName?: string | null;
  template: StudentPrivateProfileSupplementTemplate;
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(buildSupplementWorksheetName(input.studentName));
  const rows = buildStudentPrivateProfileSupplementTemplateWorkbookRows(input);
  const deleteCandidateRows = buildSupplementDeleteCandidateRows(input);
  const isFamilyTemplate =
    input.template.templateCode === 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT';

  worksheet.columns = buildStudentPrivateProfileSupplementTemplateWorkbookColumns(
    input.template.columns,
  );
  worksheet.addRows(rows);
  applySupplementTemplateWorksheetPolicy({
    columns: input.template.columns,
    isFamilyTemplate,
    rowCount: Math.max(rows.length, STUDENT_PRIVATE_PROFILE_SUPPLEMENT_TEMPLATE_FILL_ROW_COUNT),
    worksheet,
  });
  if (isFamilyTemplate) {
    applyFamilyRelationshipDisplay({
      columns: input.template.columns,
      rowCount: rows.length,
      worksheet,
    });
  }
  applySupplementStudentNameNotes({
    studentName: input.studentName,
    worksheet,
  });

  if (deleteCandidateRows.length > 0) {
    const candidateWorksheet = workbook.addWorksheet('delete_candidates');

    candidateWorksheet.columns = [
      ...buildStudentPrivateProfileSupplementTemplateWorkbookColumns(input.template.columns),
      {
        header: '_reference',
        key: '_reference',
        width: 42,
      },
    ];
    candidateWorksheet.addRows(deleteCandidateRows);
    applySupplementTemplateWorksheetPolicy({
      columns: input.template.columns,
      isFamilyTemplate,
      rowCount: deleteCandidateRows.length,
      worksheet: candidateWorksheet,
    });
    if (isFamilyTemplate) {
      applyFamilyRelationshipDisplay({
        columns: input.template.columns,
        rowCount: deleteCandidateRows.length,
        worksheet: candidateWorksheet,
      });
    }
  }

  addSupplementStudentReferenceWorksheet({
    studentId: input.summary?.studentId ?? null,
    studentName: input.studentName,
    workbook,
  });
  addSupplementTemplateInstructionWorksheet({ template: input.template, workbook });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  downloadBlob(blob, buildStudentPrivateProfileSupplementTemplateFileName(input.template));
}

export function normalizeWriteStudentPrivateProfileFamilyToUpstreamInput(input: {
  expectedSectionBaselineToken: string | null | undefined;
  members: readonly WriteStudentPrivateProfileFamilyMemberToUpstreamInput[];
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  assertSingleWriteThroughItem(input.members, '个家庭成员');

  const [member] = input.members;
  const action = normalizeWriteThroughAction(member.action);

  return {
    expectedSectionBaselineToken: normalizeSectionBaselineToken(input.expectedSectionBaselineToken),
    members: [
      action === 'CREATE'
        ? compactInput({
            action,
            name: normalizeRequiredTextValue(member.name, { label: '家庭成员姓名' }),
            phone: normalizeOptionalTextValue(member.phone, 'to_undefined'),
            relationshipCode: normalizeFamilyRelationshipCode(member.relationshipCode),
            workplace: normalizeOptionalTextValue(member.workplace, 'to_undefined'),
          })
        : {
            action,
            itemKey: normalizeRequiredTextValue(member.itemKey, {
              label: '家庭成员行标识',
            }),
            upstreamBaselineToken: normalizeRequiredTextValue(member.upstreamBaselineToken, {
              label: '家庭成员 baseline token',
            }),
          },
    ],
    studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
    upstreamSessionToken: normalizeUpstreamSessionToken(input.upstreamSessionToken),
  };
}

export function normalizeWriteStudentPrivateProfileEducationToUpstreamInput(input: {
  expectedSectionBaselineToken: string | null | undefined;
  resumes: readonly WriteStudentPrivateProfileEducationResumeToUpstreamInput[];
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  assertSingleWriteThroughItem(input.resumes, '条教育经历');

  const [resume] = input.resumes;
  const action = normalizeWriteThroughAction(resume.action);

  if (action === 'DELETE') {
    return {
      expectedSectionBaselineToken: normalizeSectionBaselineToken(
        input.expectedSectionBaselineToken,
      ),
      resumes: [
        {
          action,
          itemKey: normalizeRequiredTextValue(resume.itemKey, {
            label: '教育经历行标识',
          }),
          upstreamBaselineToken: normalizeRequiredTextValue(resume.upstreamBaselineToken, {
            label: '教育经历 baseline token',
          }),
        },
      ],
      studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
      upstreamSessionToken: normalizeUpstreamSessionToken(input.upstreamSessionToken),
    };
  }

  const startDate = normalizeWriteThroughDate(resume.startDate, '开始日期');
  const endDate = normalizeWriteThroughDate(resume.endDate, '结束日期');

  if (startDate > endDate) {
    throw new Error('开始日期不能晚于结束日期。');
  }

  return {
    expectedSectionBaselineToken: normalizeSectionBaselineToken(input.expectedSectionBaselineToken),
    resumes: [
      {
        action,
        endDate,
        organization: normalizeRequiredTextValue(resume.organization, { label: '所在单位' }),
        reference: normalizeRequiredTextValue(resume.reference, { label: '证明人' }),
        startDate,
      },
    ],
    studentId: normalizeStudentPrivateProfileStudentId(input.studentId),
    upstreamSessionToken: normalizeUpstreamSessionToken(input.upstreamSessionToken),
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

export async function getStudentPrivateProfileSupplementTemplate(input: {
  templateCode: StudentPrivateProfileSupplementTemplateCode | null | undefined;
}) {
  const response = await executeGraphQL<
    StudentPrivateProfileSupplementTemplateResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentPrivateProfileSupplementTemplateInput>;
    }
  >(STUDENT_PRIVATE_PROFILE_SUPPLEMENT_TEMPLATE_QUERY, {
    input: normalizeStudentPrivateProfileSupplementTemplateInput(input),
  });

  return response.studentPrivateProfileSupplementTemplate;
}

export async function uploadStudentPrivateProfileSupplementFile(input: {
  file: File | null | undefined;
}) {
  const file = normalizeStudentPrivateProfileSupplementFile(input.file);
  const runtimeConfig = getGraphQLRuntimeConfig();
  const dispatchUpload = () =>
    fetch(resolveStudentPrivateProfileSupplementUploadUrl(), {
      body: createSupplementUploadFormData(file),
      headers: buildSupplementUploadAuthorizationHeaders(),
      method: 'POST',
    });

  let response = await dispatchUpload();

  if (response.status === 401 && runtimeConfig.refreshSession) {
    try {
      await runtimeConfig.refreshSession();
      response = await dispatchUpload();
    } catch {
      runtimeConfig.onAuthFailure?.();
      throw new Error('登录状态已失效，请重新登录后再上传补录文件。');
    }

    if (response.status === 401) {
      runtimeConfig.onAuthFailure?.();
    }
  }

  return await parseSupplementUploadResponse(response);
}

export async function dryRunStudentPrivateProfileSupplement(input: {
  fileToken: string | null | undefined;
  templateCode: StudentPrivateProfileSupplementTemplateCode | null | undefined;
  templateVersion: number | null | undefined;
}) {
  const response = await executeGraphQL<
    StudentPrivateProfileSupplementDryRunResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeStudentPrivateProfileSupplementDryRunInput>;
    }
  >(STUDENT_PRIVATE_PROFILE_SUPPLEMENT_DRY_RUN_MUTATION, {
    input: normalizeStudentPrivateProfileSupplementDryRunInput(input),
  });

  return response.studentPrivateProfileSupplementDryRun;
}

export async function writeStudentPrivateProfileFamilyToUpstream(input: {
  expectedSectionBaselineToken: string | null | undefined;
  members: readonly WriteStudentPrivateProfileFamilyMemberToUpstreamInput[];
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  const response = await executeUpstreamSessionGraphQL<
    WriteStudentPrivateProfileFamilyToUpstreamResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeWriteStudentPrivateProfileFamilyToUpstreamInput>;
    }
  >(WRITE_STUDENT_PRIVATE_PROFILE_FAMILY_TO_UPSTREAM_MUTATION, {
    input: normalizeWriteStudentPrivateProfileFamilyToUpstreamInput(input),
  });

  return response.writeStudentPrivateProfileFamilyToUpstream;
}

export async function writeStudentPrivateProfileEducationToUpstream(input: {
  expectedSectionBaselineToken: string | null | undefined;
  resumes: readonly WriteStudentPrivateProfileEducationResumeToUpstreamInput[];
  studentId: string | null | undefined;
  upstreamSessionToken: string | null | undefined;
}) {
  const response = await executeUpstreamSessionGraphQL<
    WriteStudentPrivateProfileEducationToUpstreamResponse,
    OperationVariables & {
      input: ReturnType<typeof normalizeWriteStudentPrivateProfileEducationToUpstreamInput>;
    }
  >(WRITE_STUDENT_PRIVATE_PROFILE_EDUCATION_TO_UPSTREAM_MUTATION, {
    input: normalizeWriteStudentPrivateProfileEducationToUpstreamInput(input),
  });

  return response.writeStudentPrivateProfileEducationToUpstream;
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
