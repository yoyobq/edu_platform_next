export const upstreamSessionDemoLabMeta = {
  name: 'upstream-session-demo',
  purpose:
    '演示前端持有 upstream token、后端代访问 upstream 并读取教师字典、教职工身份、教学计划列表的完整链路。',
  owner: 'frontend',
  reviewAt: '2026-05-14',
  rollback: '移除 labs upstream session demo 路由、入口与本地存储。',
  exception: [] as string[],
} as const;
