export const academicWorkloadLabMeta = {
  name: 'academic-workload',
  purpose:
    '验证按学期与教学周范围读取教师 occurrence 基线，并在前端快速对账当前 planned contract 下的应计工作量。',
  owner: 'frontend',
  reviewAt: '2026-05-24',
  rollback: '移除 labs 教师工作量路由、入口与相关只读页面。',
  exception: [] as string[],
} as const;
