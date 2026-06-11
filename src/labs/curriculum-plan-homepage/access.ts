// src/labs/curriculum-plan-homepage/access.ts

export const curriculumPlanHomepageLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
