import { describe, expect, it } from 'vitest';

import {
  canAccessPayloadCrypto,
  hasAcademicCalendarReadAccess,
  hasAcademicIntegratedPlanCorrectionsAccess,
  hasAcademicIntegratedPlanCorrectionsManagerAccess,
  hasAcademicTeachingLogAccess,
  hasAcademicTeachingLogManagerAccess,
  hasAcademicTimetableAccess,
  hasAcademicTimetableManagerAccess,
  hasAcademicWorkloadAccess,
  hasAcademicWorkloadManagerAccess,
  hasAdminOrAcademicOfficerAccess,
  hasClassSyncAccess,
  hasMajorSyncAccess,
  hasStaffSemesterProfilesAccess,
  hasUpstreamDataSyncAccess,
} from './index';

describe('auth access policy helpers', () => {
  it('keeps academic officer access separate from teaching log manager access', () => {
    expect(
      hasAdminOrAcademicOfficerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      hasAdminOrAcademicOfficerAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(false);
  });

  it('allows staff to enter teaching logs but only admins and academic staff slots manage teacher selection', () => {
    expect(hasAcademicCalendarReadAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicTeachingLogAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicTimetableAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicTimetableAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicTeachingLogManagerAccess({ accessGroup: ['STAFF'] })).toBe(false);
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
    expect(hasAcademicTeachingLogManagerAccess({ accessGroup: ['ADMIN'] })).toBe(true);
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

  it('allows upstream sync capabilities to admins only', () => {
    expect(hasUpstreamDataSyncAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasUpstreamDataSyncAccess({
        accessGroup: ['STAFF'],
      }),
    ).toBe(false);

    expect(hasMajorSyncAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasMajorSyncAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
      }),
    ).toBe(false);
    expect(
      hasMajorSyncAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(false);
    expect(
      hasMajorSyncAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(false);
    expect(hasMajorSyncAccess({ accessGroup: ['STAFF'] })).toBe(false);

    expect(hasClassSyncAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(
      hasClassSyncAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
      }),
    ).toBe(false);
    expect(
      hasClassSyncAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(false);
    expect(hasClassSyncAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('allows academic timetable manager selection to admins and academic staff slots', () => {
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

  it('allows workload self-service to staff and workload management to academic staff slots', () => {
    expect(hasAcademicWorkloadAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAcademicWorkloadAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicWorkloadAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicWorkloadManagerAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasAcademicWorkloadManagerAccess({ accessGroup: ['STAFF'] })).toBe(false);
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

  it('limits payload crypto access to the configured admin accounts', () => {
    expect(canAccessPayloadCrypto({ accountId: 1, accessGroup: ['ADMIN'] })).toBe(true);
    expect(canAccessPayloadCrypto({ accountId: 2, accessGroup: ['ADMIN'] })).toBe(true);
    expect(canAccessPayloadCrypto({ accountId: 3, accessGroup: ['ADMIN'] })).toBe(false);
    expect(canAccessPayloadCrypto({ accountId: 1, accessGroup: ['STAFF'] })).toBe(false);
  });
});
