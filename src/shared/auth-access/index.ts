export const AUTH_ACCESS_GROUPS = ['ADMIN', 'GUEST', 'REGISTRANT', 'STAFF', 'STUDENT'] as const;

export type AuthAccessGroup = (typeof AUTH_ACCESS_GROUPS)[number];
export type AcademicViewerRole = 'admin' | 'authenticated' | 'staff';
export type AcademicInternalViewerRole = Exclude<AcademicViewerRole, 'authenticated'>;
export type UpstreamLoginIdentityContext = 'default' | 'academicStaffManager';

export const ACADEMIC_OFFICER_SLOT_GROUP = 'ACADEMIC_OFFICER';
export const CLASS_ADVISER_SLOT_GROUP = 'CLASS_ADVISER';
export const COUNSELOR_SLOT_GROUP = 'COUNSELOR';
export const STUDENT_AFFAIRS_OFFICER_SLOT_GROUP = 'STUDENT_AFFAIRS_OFFICER';
export const TEACHING_GROUP_LEADER_SLOT_GROUP = 'TEACHING_GROUP_LEADER';

export function isAuthAccessGroup(value: unknown): value is AuthAccessGroup {
  return typeof value === 'string' && (AUTH_ACCESS_GROUPS as readonly string[]).includes(value);
}
