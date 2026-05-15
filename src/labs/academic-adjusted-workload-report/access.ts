// src/labs/academic-adjusted-workload-report/access.ts

export const academicAdjustedWorkloadReportLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
