// src/features/student-roster-membership-reconciliation/application/roster-sync-permission.ts

import {
  type AuthAccessGroup,
  CLASS_ADVISER_SLOT_GROUP,
  COUNSELOR_SLOT_GROUP,
  STUDENT_AFFAIRS_OFFICER_SLOT_GROUP,
} from '@/shared/auth-access';

export type RosterSyncPermissionStrategy =
  | 'claim-before-dry-run'
  | 'dry-run-before-claim'
  | 'dry-run-only';

export function resolveRosterSyncPermissionStrategy(input: {
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
}): RosterSyncPermissionStrategy {
  if (input.accessGroup.includes('ADMIN')) {
    return 'dry-run-only';
  }

  if (
    input.slotGroup.includes(COUNSELOR_SLOT_GROUP) ||
    input.slotGroup.includes(STUDENT_AFFAIRS_OFFICER_SLOT_GROUP)
  ) {
    return 'dry-run-only';
  }

  if (input.slotGroup.includes(CLASS_ADVISER_SLOT_GROUP)) {
    return 'dry-run-before-claim';
  }

  return 'claim-before-dry-run';
}
