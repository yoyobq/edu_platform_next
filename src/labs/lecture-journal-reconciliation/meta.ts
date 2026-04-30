export const lectureJournalReconciliationLabMeta = {
  name: 'lecture-journal-reconciliation',
  purpose:
    '验证按学年学期读取上游教学计划与教学日志对账结果，并支持筛选、预填、编辑与保存教学日志。',
  owner: 'frontend',
  reviewAt: '2026-05-25',
  rollback: '移除 labs 教学日志对账路由、入口与相关查询、预填、保存页面。',
  exception: [] as string[],
} as const;
