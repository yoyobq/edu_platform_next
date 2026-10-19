// src/labs/teaching-inspection/access.ts
export const teachingInspectionLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
