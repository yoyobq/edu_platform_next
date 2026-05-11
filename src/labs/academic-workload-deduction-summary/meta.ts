// src/labs/academic-workload-deduction-summary/meta.ts

export const academicWorkloadDeductionSummaryLabMeta = {
  name: 'academic-workload-deduction-summary',
  purpose: '验证管理侧教师假日扣课课时汇总表的真实使用效果。',
  owner: 'frontend',
  reviewAt: '2026-06-30',
  rollback: '移除 labs academic-workload-deduction-summary 路由、导航入口与实验内 GraphQL 封装。',
  exception: [] as string[],
} as const;
