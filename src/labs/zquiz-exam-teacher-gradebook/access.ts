// src/labs/zquiz-exam-teacher-gradebook/access.ts

export const zquizExamTeacherGradebookLabAccess = {
  allowedAccessLevels: ['admin', 'staff'],
  env: ['dev', 'prod'],
  menu: true,
} as const;
