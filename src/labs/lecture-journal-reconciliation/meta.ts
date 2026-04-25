export const lectureJournalReconciliationLabMeta = {
  name: 'lecture-journal-reconciliation',
  purpose:
    '验证按学年学期读取上游教学计划与教学日志对账结果，快速统计某位教师在指定学期内的日志填写情况。',
  owner: 'frontend',
  reviewAt: '2026-05-25',
  rollback: '移除 labs 教学日志对账路由、入口与相关只读页面。',
  exception: [] as string[],
} as const;
