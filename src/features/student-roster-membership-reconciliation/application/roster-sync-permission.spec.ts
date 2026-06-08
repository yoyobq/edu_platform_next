// src/features/student-roster-membership-reconciliation/application/roster-sync-permission.spec.ts

import { describe, expect, it } from 'vitest';

import {
  hasRosterMembershipLocalClassOptionsAccess,
  resolveRosterSyncPermissionStrategy,
} from './roster-sync-permission';

describe('roster sync permission strategy', () => {
  it('lets admins dry-run directly', () => {
    expect(
      resolveRosterSyncPermissionStrategy({
        accessGroup: ['ADMIN'],
        slotGroup: [],
      }),
    ).toBe('dry-run-only');
    expect(
      hasRosterMembershipLocalClassOptionsAccess({
        accessGroup: ['ADMIN'],
        slotGroup: [],
      }),
    ).toBe(true);
  });

  it('lets local class option slots dry-run directly', () => {
    expect(
      resolveRosterSyncPermissionStrategy({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe('dry-run-only');
    expect(
      hasRosterMembershipLocalClassOptionsAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    ).toBe(true);
    expect(
      resolveRosterSyncPermissionStrategy({
        accessGroup: ['STAFF'],
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
      }),
    ).toBe('dry-run-only');
    expect(
      hasRosterMembershipLocalClassOptionsAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
      }),
    ).toBe(true);
  });

  it('lets counselor dry-run directly without local class options', () => {
    expect(
      resolveRosterSyncPermissionStrategy({
        accessGroup: ['STAFF'],
        slotGroup: ['COUNSELOR'],
      }),
    ).toBe('dry-run-only');
    expect(
      hasRosterMembershipLocalClassOptionsAccess({
        accessGroup: ['STAFF'],
        slotGroup: ['COUNSELOR'],
      }),
    ).toBe(false);
  });

  it('tries dry-run before claim for class advisers', () => {
    expect(
      resolveRosterSyncPermissionStrategy({
        accessGroup: ['STAFF'],
        slotGroup: ['CLASS_ADVISER'],
      }),
    ).toBe('dry-run-before-claim');
  });

  it('claims before dry-run for regular staff without roster-sync slots', () => {
    expect(
      resolveRosterSyncPermissionStrategy({
        accessGroup: ['STAFF'],
        slotGroup: [],
      }),
    ).toBe('claim-before-dry-run');
    expect(
      hasRosterMembershipLocalClassOptionsAccess({
        accessGroup: ['STAFF'],
        slotGroup: [],
      }),
    ).toBe(false);
  });
});
