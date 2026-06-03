// src/labs/student-roster-membership-reconciliation/meta.ts

export const studentRosterMembershipReconciliationLabMeta = {
  name: 'student-roster-membership-reconciliation',
  purpose:
    '提供单班学生名册归属核对流程，验证 upstream roster 与本地班级归属 membership / decision 的 dry-run、确认与 commit 链路。',
  owner: 'frontend',
  reviewAt: '2026-06-03',
  rollback: '移除 labs student roster membership reconciliation 路由、入口与本地页面代码。',
  exception: [] as string[],
} as const;
