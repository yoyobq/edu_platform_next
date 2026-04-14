export const upstreamSessionDemoLabMeta = {
  name: 'upstream-session-demo',
  purpose: '演示前端持有 upstream token、后端代访问 upstream 并返回教师字典结果的完整链路。',
  owner: 'frontend',
  reviewAt: '2026-05-14',
  rollback: '移除 labs upstream session demo 路由、入口与本地存储。',
  exception: [] as string[],
} as const;
