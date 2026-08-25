// src/labs/student-evaluation-comment-workbench/access.ts

export const studentEvaluationCommentWorkbenchLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
