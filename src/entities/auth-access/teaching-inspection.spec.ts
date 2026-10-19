// src/entities/auth-access/teaching-inspection.spec.ts
import { describe, expect, it } from 'vitest';

import { hasTeachingInspectionAccess } from './index';
describe('教学检查专用准入', () => {
  it('管理员无需绑定 staff 即可进入', () => {
    expect(hasTeachingInspectionAccess({ accessGroup: ['ADMIN'] })).toBe(true);
    expect(hasTeachingInspectionAccess({ accessGroup: ['ADMIN'], staffId: 'T1' })).toBe(true);
  });
  it('教务与普通 staff 不准入，当前组长准入', () => {
    expect(hasTeachingInspectionAccess({ accessGroup: ['STAFF'], staffId: 'T1' })).toBe(false);
    expect(
      hasTeachingInspectionAccess({
        accessGroup: ['STAFF'],
        staffId: 'T1',
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(false);
    expect(
      hasTeachingInspectionAccess({
        accessGroup: ['STAFF'],
        staffId: 'T1',
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    ).toBe(true);
  });
});
