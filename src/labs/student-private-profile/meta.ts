// src/labs/student-private-profile/meta.ts

export const studentPrivateProfileLabMeta = {
  name: 'student-private-profile',
  purpose: '验证学生个人敏感资料脱敏摘要读取、显式 upstream 刷新、候选核验与人工修正链路。',
  owner: 'frontend',
  reviewAt: '2026-08-31',
  rollback: '移除 labs student-private-profile 路由、页面和实验 API。',
  exception: [] as string[],
} as const;
