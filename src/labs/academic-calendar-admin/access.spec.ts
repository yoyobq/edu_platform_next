import { describe, expect, it } from 'vitest';

import { hasAcademicCalendarAdminLabAccess } from './access';

describe('hasAcademicCalendarAdminLabAccess', () => {
  it('allows admin accounts without slot groups', () => {
    expect(
      hasAcademicCalendarAdminLabAccess({
        accessGroup: ['ADMIN'],
        slotGroup: [],
      }),
    ).toBe(true);
  });

  it('allows staff accounts with ACADEMIC_OFFICER slotGroup from jwt claims', () => {
    expect(
      hasAcademicCalendarAdminLabAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
  });

  it('rejects staff accounts without the required slotGroup', () => {
    expect(
      hasAcademicCalendarAdminLabAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['CLASS_ADVISER'],
      }),
    ).toBe(false);
  });
});
