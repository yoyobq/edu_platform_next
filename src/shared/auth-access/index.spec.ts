import { describe, expect, it } from 'vitest';

import {
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

  it('allows staff to enter teaching logs but only admins and teaching group leaders manage teacher selection', () => {
    expect(hasAcademicTeachingLogAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicTimetableAccess({ accessGroup: ['STAFF'] })).toBe(true);
    expect(hasAcademicTimetableAccess({ accessGroup: ['STUDENT'] })).toBe(false);
    expect(hasAcademicTeachingLogManagerAccess({ accessGroup: ['STAFF'] })).toBe(false);
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
});
