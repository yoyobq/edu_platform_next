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
  profileCompletenessFlags: {
    educationObserved: boolean;
    familyObserved: boolean;
    personalObserved: boolean;
    photoObserved: boolean;
    recordObserved: boolean;
    sensitiveIdentifiersObserved: boolean;
  };
  recordChanges: StudentPrivateProfileSummaryRecordChange[];
  sectionStatuses: StudentPrivateProfileSummarySectionStatus[];
  sourceObservedAt: string;
  studentId: string;
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

type RefreshStudentPrivateProfileResponse = {
  refreshStudentPrivateProfileFromUpstream: StudentPrivateProfileRefreshResult;
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

export function normalizeListClassStudentOptionsInput(input: {
  classId: string | null | undefined;
}) {
  return {
    classId: normalizeRequiredTextValue(input.classId, { label: '班级 ID' }),
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
