// src/labs/student-evaluation-comment/access.ts

export const studentEvaluationCommentLabAccess = {
  allowedAccessLevels: ['admin', 'staff', 'student'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
