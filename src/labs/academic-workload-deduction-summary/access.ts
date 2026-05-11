// src/labs/academic-workload-deduction-summary/access.ts

export const academicWorkloadDeductionSummaryLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
