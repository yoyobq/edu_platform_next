export const AUTH_ACCESS_GROUPS = ['ADMIN', 'GUEST', 'REGISTRANT', 'STAFF', 'STUDENT'] as const;

export type AuthAccessGroup = (typeof AUTH_ACCESS_GROUPS)[number];
export type AcademicViewerRole = 'admin' | 'authenticated' | 'staff';
export type AcademicInternalViewerRole = Exclude<AcademicViewerRole, 'authenticated'>;

export const ACADEMIC_OFFICER_SLOT_GROUP = 'ACADEMIC_OFFICER';
export const TEACHING_GROUP_LEADER_SLOT_GROUP = 'TEACHING_GROUP_LEADER';

export function isAuthAccessGroup(value: unknown): value is AuthAccessGroup {
  return typeof value === 'string' && (AUTH_ACCESS_GROUPS as readonly string[]).includes(value);
}

export function hasAdminOrAcademicOfficerAccess(input: {
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

export function hasAcademicCalendarReadAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicTimetableAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  const accessGroup = input.accessGroup ?? [];

  return accessGroup.includes('ADMIN') || accessGroup.includes('STAFF');
}

export function hasAcademicTeachingLogManagerAccess(input: {
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

export function hasStaffSemesterProfilesAccess(input: {
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

export function canAccessPayloadCrypto(input: {
  accountId?: number | null;
  accessGroup?: readonly string[];
}) {
  const accessGroup = input.accessGroup ?? [];

  return (input.accountId === 1 || input.accountId === 2) && accessGroup.includes('ADMIN');
}
