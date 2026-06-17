// src/features/student-roster-membership-reconciliation/application/roster-sync-permission.ts

import {
  ACADEMIC_OFFICER_SLOT_GROUP,
  type AuthAccessGroup,
  CLASS_ADVISER_SLOT_GROUP,
  COUNSELOR_SLOT_GROUP,
  STUDENT_AFFAIRS_OFFICER_SLOT_GROUP,
} from '@/entities/auth-access';

export type RosterSyncPermissionStrategy =
  | 'claim-before-dry-run'
  | 'dry-run-before-claim'
  | 'dry-run-only';

export function hasRosterMembershipLocalClassOptionsAccess(input: {
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
}) {
  if (input.accessGroup.includes('ADMIN')) {
    return true;
  }

  return (
    input.accessGroup.includes('STAFF') &&
    (input.slotGroup.includes(ACADEMIC_OFFICER_SLOT_GROUP) ||
      input.slotGroup.includes(STUDENT_AFFAIRS_OFFICER_SLOT_GROUP))
  );
}

export function resolveRosterSyncPermissionStrategy(input: {
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
}): RosterSyncPermissionStrategy {
  if (hasRosterMembershipLocalClassOptionsAccess(input)) {
    return 'dry-run-only';
  }

  if (input.slotGroup.includes(COUNSELOR_SLOT_GROUP)) {
    return 'dry-run-only';
  }

  if (input.slotGroup.includes(CLASS_ADVISER_SLOT_GROUP)) {
    return 'dry-run-before-claim';
  }

  return 'claim-before-dry-run';
}
