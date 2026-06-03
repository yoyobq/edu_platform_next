// src/labs/student-roster-membership-reconciliation/access.ts

export const studentRosterMembershipReconciliationLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: false,
} as const;
