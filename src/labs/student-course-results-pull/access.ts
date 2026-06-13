// src/labs/student-course-results-pull/access.ts

export const studentCourseResultsPullLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
