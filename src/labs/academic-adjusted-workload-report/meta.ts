// src/labs/academic-adjusted-workload-report/meta.ts

export const academicAdjustedWorkloadReportLabMeta = {
  name: 'academic-adjusted-workload-report',
  purpose: '验证 getAcademicAdjustedWorkloadReport 调整后教师工作量报表接口。',
  owner: 'frontend',
  reviewAt: '2026-06-30',
  rollback: '移除实验路由与当前 lab API/UI 文件。',
  exception: [] as string[],
} as const;
