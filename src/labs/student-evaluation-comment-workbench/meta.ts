// src/labs/student-evaluation-comment-workbench/meta.ts

export const studentEvaluationCommentWorkbenchLabMeta = {
  name: 'student-evaluation-comment-workbench',
  purpose: '验证以学期为一级作用域、以学生评语状态流为核心的教师产品化工作台。',
  owner: 'frontend',
  reviewAt: '2026-10-31',
  rollback: '移除 student-evaluation-comment-workbench lab 的路由、导航和模块目录。',
  exception: [] as string[],
} as const;
