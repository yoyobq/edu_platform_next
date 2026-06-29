// src/entities/auth-access/index.spec.ts

import { describe, expect, it } from 'vitest';

import {
  AUTH_ACCESS_GROUPS,
  canAccessPayloadCrypto,
  DEFAULT_CLASS_ADVISER_GOVERNANCE_DEPARTMENT_ID,
  hasAcademicCalendarManagementAccess,
  hasAcademicCalendarReadAccess,
  hasAcademicCurriculumPlanHomepageAccess,
  hasAcademicCurriculumPlanHomepageManagerAccess,
  hasAcademicIntegratedPlanCorrectionsAccess,
  hasAcademicIntegratedPlanCorrectionsManagerAccess,
  hasAcademicTeachingLogAccess,
  hasAcademicTeachingLogManagerAccess,
  hasAcademicTimetableAccess,
  hasAcademicTimetableManagerAccess,
  hasAcademicWorkloadAccess,
  hasAcademicWorkloadManagerAccess,
  hasAdminAccess,
  hasClassAdviserGovernanceAccess,
  hasClassAffairsCourseResultsAccess,
  hasStaffSemesterProfilesAccess,
  hasStudentProfileFilingAccess,
  hasStudentRosterMembershipReconciliationAccess,
  hasUpstreamDataSyncAccess,
  isAuthAccessGroup,
  resolveClassAdviserGovernanceDepartmentScope,
  resolveUpstreamLoginLockedUserId,
} from './index';

describe('auth access policy', () => {
  it('recognizes known auth access groups', () => {
    expect(AUTH_ACCESS_GROUPS).toEqual(['ADMIN', 'GUEST', 'REGISTRANT', 'STAFF', 'STUDENT']);
    expect(isAuthAccessGroup('ADMIN')).toBe(true);
    expect(isAuthAccessGroup('STAFF')).toBe(true);
    expect(isAuthAccessGroup('UNKNOWN')).toBe(false);
  });

  it('recognizes admin access from access groups', () => {
    expect(hasAdminAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAdminAccess({ accessGroup: ['ADMIN', 'STAFF'] })).toBe(true);
    expect(hasAdminAccess({ accessGroup: ['STAFF'] })).toBe(false);
    expect(hasAdminAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAdminAccess({})).toBe(false);
  });

  it('keeps academic calendar management limited to admins and academic officers', () => {
    expect(hasAcademicCalendarReadAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicCalendarManagementAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasAcademicCalendarManagementAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasAcademicCalendarManagementAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(false);
  });

  it('allows staff to enter teaching logs but only academic staff slots manage teacher selection', () => {
    expect(hasAcademicTeachingLogAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAcademicTeachingLogAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicTeachingLogAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicTeachingLogManagerAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasAcademicTeachingLogManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasAcademicTeachingLogManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(true);
    expect(hasAcademicTeachingLogManagerAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('allows academic timetable self-service and manager selection with academic staff slots', () => {
    expect(hasAcademicTimetableAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAcademicTimetableAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicTimetableAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicTimetableManagerAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasAcademicTimetableManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasAcademicTimetableManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(true);
    expect(hasAcademicTimetableManagerAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('allows workload self-service and manager selection with academic staff slots', () => {
    expect(hasAcademicWorkloadAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAcademicWorkloadAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicWorkloadAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicWorkloadManagerAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasAcademicWorkloadManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasAcademicWorkloadManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(true);
    expect(hasAcademicWorkloadManagerAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('allows integrated plan corrections to staff self-service and manager selection', () => {
    expect(hasAcademicIntegratedPlanCorrectionsAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAcademicIntegratedPlanCorrectionsAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicIntegratedPlanCorrectionsAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicIntegratedPlanCorrectionsManagerAccess({ accessGroup: ['ADMIN'] })).toBe(
      true,
    );
    expect(
      hasAcademicIntegratedPlanCorrectionsManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasAcademicIntegratedPlanCorrectionsManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(true);
    expect(hasAcademicIntegratedPlanCorrectionsManagerAccess({ accessGroup: ['STAFF'] })).toBe(
      false,
    );
  });

  it('allows curriculum plan homepage to staff self-service and manager selection', () => {
    expect(hasAcademicCurriculumPlanHomepageAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAcademicCurriculumPlanHomepageAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicCurriculumPlanHomepageAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicCurriculumPlanHomepageManagerAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasAcademicCurriculumPlanHomepageManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasAcademicCurriculumPlanHomepageManagerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(true);
    expect(hasAcademicCurriculumPlanHomepageManagerAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('allows staff semester profiles to admins and academic officers', () => {
    expect(hasStaffSemesterProfilesAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasStaffSemesterProfilesAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasStaffSemesterProfilesAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(false);
    expect(hasStaffSemesterProfilesAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('allows class adviser governance to admins, academic officers, and student affairs officers', () => {
    expect(hasClassAdviserGovernanceAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasClassAdviserGovernanceAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasClassAdviserGovernanceAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasClassAdviserGovernanceAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['CLASS_ADVISER'],
      }),
    ).toBe(false);
    expect(
      hasClassAdviserGovernanceAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['COUNSELOR'],
      }),
    ).toBe(false);
    expect(hasClassAdviserGovernanceAccess({ accessGroup: ['STAFF'] })).toBe(false);
    expect(hasClassAdviserGovernanceAccess({ accessGroup: ['STUDENT'] })).toBe(false);
  });

  it('resolves class adviser governance department scope from the current account', () => {
    expect(resolveClassAdviserGovernanceDepartmentScope({ accessGroup: ['ADMIN'] })).toEqual({
      canSelectDepartment: true,
      defaultDepartmentId: DEFAULT_CLASS_ADVISER_GOVERNANCE_DEPARTMENT_ID,
      isForbidden: false,
    });
    expect(
      resolveClassAdviserGovernanceDepartmentScope({
        accessGroup: ['STAFF'],
        staffDepartmentId: ' ORG0306 ',
      }),
    ).toEqual({
      canSelectDepartment: false,
      defaultDepartmentId: 'ORG0306',
      isForbidden: false,
    });
    expect(
      resolveClassAdviserGovernanceDepartmentScope({
        accessGroup: ['STAFF'],
        staffDepartmentId: null,
      }),
    ).toEqual({
      canSelectDepartment: false,
      defaultDepartmentId: null,
      isForbidden: true,
    });
  });

  it('allows roster membership reconciliation entry to admins and staff', () => {
    expect(hasStudentRosterMembershipReconciliationAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasStudentRosterMembershipReconciliationAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasStudentRosterMembershipReconciliationAccess({ accessGroup: ['STUDENT'] })).toBe(
      false,
    );
    expect(hasStudentRosterMembershipReconciliationAccess({ accessGroup: ['GUEST'] })).toBe(false);
  });

  it('allows student profile filing to admins and scoped staff slots', () => {
    expect(hasStudentProfileFilingAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasStudentProfileFilingAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasStudentProfileFilingAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasStudentProfileFilingAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['CLASS_ADVISER'],
      }),
    ).toBe(true);
    expect(
      hasStudentProfileFilingAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['COUNSELOR'],
      }),
    ).toBe(true);
    expect(
      hasStudentProfileFilingAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(false);
    expect(hasStudentProfileFilingAccess({ accessGroup: ['STAFF'] })).toBe(false);
    expect(hasStudentProfileFilingAccess({ accessGroup: ['STUDENT'] })).toBe(false);
  });

  it('limits upstream data sync to admins', () => {
    expect(hasUpstreamDataSyncAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasUpstreamDataSyncAccess({ accessGroup: ['STAFF'] })).toBe(false);
    expect(hasUpstreamDataSyncAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasUpstreamDataSyncAccess({ accessGroup: ['GUEST'] })).toBe(false);
    expect(hasUpstreamDataSyncAccess({})).toBe(false);
  });

  it('allows class affairs course results to class advisers and counselors only', () => {
    expect(
      hasClassAffairsCourseResultsAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['CLASS_ADVISER'],
      }),
    ).toBe(true);
    expect(
      hasClassAffairsCourseResultsAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['COUNSELOR'],
      }),
    ).toBe(true);
    expect(hasClassAffairsCourseResultsAccess({ accessGroup: ['ADMIN'] })).toBe(false);
    expect(hasClassAffairsCourseResultsAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('limits payload crypto access to configured admin accounts', () => {
    expect(canAccessPayloadCrypto({ accountId: 1, accessGroup: ['ADMIN'] })).toBe(true);
    expect(canAccessPayloadCrypto({ accountId: 2, accessGroup: ['ADMIN'] })).toBe(true);
    expect(canAccessPayloadCrypto({ accountId: 3, accessGroup: ['ADMIN'] })).toBe(false);
    expect(canAccessPayloadCrypto({ accountId: 1, accessGroup: ['STAFF'] })).toBe(false);
    expect(canAccessPayloadCrypto(null)).toBe(false);
    expect(canAccessPayloadCrypto(undefined)).toBe(false);
    expect(
      canAccessPayloadCrypto({
        accountId: 1,
        userInfo: {
          accessGroup: ['ADMIN'],
        },
      }),
    ).toBe(true);
  });

  it('resolves upstream login locked identity from access group and context', () => {
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['ADMIN', 'STAFF'],
        staffId: 'staff-001',
      }),
    ).toBeNull();
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['STAFF'],
        staffId: ' staff-001 ',
      }),
    ).toBe('staff-001');
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
        staffId: 'staff-001',
      }),
    ).toBe('staff-001');
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['STAFF'],
        context: 'academicStaffManager',
        slotGroup: ['ACADEMIC_OFFICER'],
        staffId: 'staff-001',
      }),
    ).toBeNull();
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['STAFF'],
        context: 'academicStaffManager',
        slotGroup: ['TEACHING_GROUP_LEADER'],
        staffId: 'staff-001',
      }),
    ).toBeNull();
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['STAFF'],
        context: 'academicStaffManager',
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
        staffId: 'staff-001',
      }),
    ).toBe('staff-001');
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['STUDENT'],
        staffId: 'student-001',
      }),
    ).toBeNull();
    expect(
      resolveUpstreamLoginLockedUserId({
        accessGroup: ['STAFF'],
        staffId: null,
      }),
    ).toBeNull();
  });
});
