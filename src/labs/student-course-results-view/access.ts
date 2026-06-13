// src/labs/student-course-results-view/access.ts

export const studentCourseResultsViewLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
