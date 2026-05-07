import { describe, expect, it } from 'vitest';

import {
  canAccessPayloadCrypto,
  hasAcademicCalendarReadAccess,
  hasAcademicTeachingLogAccess,
  hasAcademicTeachingLogManagerAccess,
  hasAcademicTimetableAccess,
  hasAdminOrAcademicOfficerAccess,
  hasStaffSemesterProfilesAccess,
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

  it('allows staff semester profiles to admins, academic officers, and teaching group leaders', () => {
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
    ).toBe(true);
    expect(hasStaffSemesterProfilesAccess({ accessGroup: ['STAFF'] })).toBe(false);
  });

  it('limits payload crypto access to the configured admin accounts', () => {
    expect(canAccessPayloadCrypto({ accountId: 1, accessGroup: ['ADMIN'] })).toBe(true);
    expect(canAccessPayloadCrypto({ accountId: 2, accessGroup: ['ADMIN'] })).toBe(true);
    expect(canAccessPayloadCrypto({ accountId: 3, accessGroup: ['ADMIN'] })).toBe(false);
    expect(canAccessPayloadCrypto({ accountId: 1, accessGroup: ['STAFF'] })).toBe(false);
  });
});
