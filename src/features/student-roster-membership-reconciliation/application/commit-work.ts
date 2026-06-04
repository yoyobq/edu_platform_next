// src/features/student-roster-membership-reconciliation/application/commit-work.ts

import type { StudentRosterMembershipReconciliationItem } from './types';

export function hasAutomaticRosterCommitWork(
  items: readonly StudentRosterMembershipReconciliationItem[],
) {
  return items.some((item) => item.category === 'AUTO_APPLY' && item.action !== 'NO_CHANGE');
}
