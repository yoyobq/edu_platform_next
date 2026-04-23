export const courseScheduleSyncLabMeta = {
  name: 'course-schedule-sync',
  purpose: '验证前端持有 upstream token、后端按系部教学计划拉取并同步课程表的完整链路。',
  owner: 'frontend',
  reviewAt: '2026-05-30',
  rollback: '移除 labs 课程表同步路由、入口与页面实现。',
  exception: ['复用 shared/upstream 维护当前账号绑定的 upstream token。'] as string[],
} as const;
