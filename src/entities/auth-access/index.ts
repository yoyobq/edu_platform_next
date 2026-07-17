// src/entities/auth-access/index.ts

export {
  ACADEMIC_OFFICER_SLOT_GROUP,
  type AcademicInternalViewerRole,
  type AcademicViewerRole,
  AUTH_ACCESS_GROUPS,
  type AuthAccessGroup,
  CLASS_ADVISER_SLOT_GROUP,
  COUNSELOR_SLOT_GROUP,
  isAuthAccessGroup,
  STUDENT_AFFAIRS_OFFICER_SLOT_GROUP,
  TEACHING_GROUP_LEADER_SLOT_GROUP,
  type UpstreamLoginIdentityContext,
} from '@/shared/auth-access';

import {
  ACADEMIC_OFFICER_SLOT_GROUP,
  type AuthAccessGroup,
  CLASS_ADVISER_SLOT_GROUP,
  COUNSELOR_SLOT_GROUP,
  STUDENT_AFFAIRS_OFFICER_SLOT_GROUP,
  TEACHING_GROUP_LEADER_SLOT_GROUP,
  type UpstreamLoginIdentityContext,
} from '@/shared/auth-access';

type PayloadCryptoAccessSession = {
  accountId?: number | null;
  userInfo: {
    accessGroup: readonly string[];
  };
};

type PayloadCryptoAccessInput = {
  accountId?: number | null;
  accessGroup?: readonly string[];
};

export const DEFAULT_CLASS_ADVISER_GOVERNANCE_DEPARTMENT_ID = 'ORG0302';

function hasAcademicStaffManagerAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  const accessGroup = input.accessGroup ?? [];
  const slotGroup = input.slotGroup ?? [];

  if (accessGroup.includes('ADMIN')) {
    return true;
  }

  return (
    accessGroup.includes('STAFF') &&
    (slotGroup.includes(ACADEMIC_OFFICER_SLOT_GROUP) ||
      slotGroup.includes(TEACHING_GROUP_LEADER_SLOT_GROUP))
  );
}

export function hasAdminAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN');
}

export function hasAcademicCalendarReadAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicCalendarManagementAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  const accessGroup = input.accessGroup ?? [];

  if (accessGroup.includes('ADMIN')) {
    return true;
  }

  return (
    accessGroup.includes('STAFF') && (input.slotGroup ?? []).includes(ACADEMIC_OFFICER_SLOT_GROUP)
  );
}

export function hasAcademicTeachingLogAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicTeachingLogManagerAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  return hasAcademicStaffManagerAccess(input);
}

export function hasAcademicTimetableAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicTimetableManagerAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  return hasAcademicStaffManagerAccess(input);
}

export function hasAcademicWorkloadAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicWorkloadManagerAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  return hasAcademicStaffManagerAccess(input);
}

export function hasAcademicIntegratedPlanCorrectionsAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
}) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicIntegratedPlanCorrectionsManagerAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  return hasAcademicStaffManagerAccess(input);
}

export function hasAcademicCurriculumPlanHomepageAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
}) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicCurriculumPlanHomepageManagerAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  return hasAcademicStaffManagerAccess(input);
}

export function hasStaffSemesterProfilesAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  return hasAcademicCalendarManagementAccess(input);
}

export function hasClassAdviserGovernanceAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  const accessGroup = input.accessGroup ?? [];
  const slotGroup = input.slotGroup ?? [];

  if (accessGroup.includes('ADMIN')) {
    return true;
  }

  return (
    accessGroup.includes('STAFF') &&
    (slotGroup.includes(ACADEMIC_OFFICER_SLOT_GROUP) ||
      slotGroup.includes(STUDENT_AFFAIRS_OFFICER_SLOT_GROUP))
  );
}

export function resolveClassAdviserGovernanceDepartmentScope(input: {
  accessGroup?: readonly AuthAccessGroup[];
  staffDepartmentId?: string | null;
}) {
  const accessGroup = input.accessGroup ?? [];

  if (accessGroup.includes('ADMIN')) {
    return {
      canSelectDepartment: true,
      defaultDepartmentId: DEFAULT_CLASS_ADVISER_GOVERNANCE_DEPARTMENT_ID,
      isForbidden: false,
    };
  }

  const staffDepartmentId = input.staffDepartmentId?.trim() || null;

  return {
    canSelectDepartment: false,
    defaultDepartmentId: staffDepartmentId,
    isForbidden: !staffDepartmentId,
  };
}

export function hasStudentRosterMembershipReconciliationAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
}) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasStudentProfileFilingAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  const accessGroup = input.accessGroup ?? [];
  const slotGroup = input.slotGroup ?? [];

  if (accessGroup.includes('ADMIN')) {
    return true;
  }

  return (
    accessGroup.includes('STAFF') &&
    (slotGroup.includes(ACADEMIC_OFFICER_SLOT_GROUP) ||
      slotGroup.includes(STUDENT_AFFAIRS_OFFICER_SLOT_GROUP) ||
      slotGroup.includes(CLASS_ADVISER_SLOT_GROUP) ||
      slotGroup.includes(COUNSELOR_SLOT_GROUP))
  );
}

export function hasStudentConductAlignmentAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  const accessGroup = input.accessGroup ?? [];
  const slotGroup = input.slotGroup ?? [];

  return (
    accessGroup.includes('ADMIN') ||
    (accessGroup.includes('STAFF') &&
      (slotGroup.includes(ACADEMIC_OFFICER_SLOT_GROUP) ||
        slotGroup.includes(CLASS_ADVISER_SLOT_GROUP) ||
        slotGroup.includes(COUNSELOR_SLOT_GROUP)))
  );
}

export function hasUpstreamDataSyncAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN');
}

export function hasClassAffairsCourseResultsAccess(input: {
  accessGroup?: readonly AuthAccessGroup[];
  slotGroup?: readonly string[];
}) {
  const accessGroup = input.accessGroup ?? [];
  const slotGroup = input.slotGroup ?? [];

  return (
    accessGroup.includes('ADMIN') ||
    (accessGroup.includes('STAFF') &&
      (slotGroup.includes(CLASS_ADVISER_SLOT_GROUP) ||
        slotGroup.includes(COUNSELOR_SLOT_GROUP) ||
        slotGroup.includes(STUDENT_AFFAIRS_OFFICER_SLOT_GROUP)))
  );
}

function isPayloadCryptoAccessSession(
  value: PayloadCryptoAccessInput | PayloadCryptoAccessSession,
): value is PayloadCryptoAccessSession {
  return 'userInfo' in value;
}

export function canAccessPayloadCrypto(
  input: PayloadCryptoAccessInput | PayloadCryptoAccessSession | null | undefined,
) {
  if (!input) {
    return false;
  }

  const accessGroup = isPayloadCryptoAccessSession(input)
    ? input.userInfo.accessGroup
    : (input.accessGroup ?? []);

  return Boolean((input.accountId === 1 || input.accountId === 2) && accessGroup.includes('ADMIN'));
}

export function resolveUpstreamLoginLockedUserId(input: {
  accessGroup?: readonly AuthAccessGroup[];
  context?: UpstreamLoginIdentityContext;
  slotGroup?: readonly string[];
  staffId?: string | null;
}) {
  const accessGroup = input.accessGroup ?? [];

  if (accessGroup.includes('ADMIN')) {
    return null;
  }

  if (
    input.context === 'academicStaffManager' &&
    hasAcademicStaffManagerAccess({
      accessGroup,
      slotGroup: input.slotGroup,
    })
  ) {
    return null;
  }

  if (!accessGroup.includes('STAFF')) {
    return null;
  }

  return input.staffId?.trim() || null;
}
