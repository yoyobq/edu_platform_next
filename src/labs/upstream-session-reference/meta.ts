// src/labs/upstream-session-reference/meta.ts

export const upstreamSessionReferenceLabMeta = {
  name: 'upstream-session-reference',
  purpose:
    '提供一张纯净的 upstream session 登录、恢复与 modal controller 参考页，作为后续 labs 接入 upstream session 的基准样板。',
  owner: 'frontend',
  reviewAt: '2026-08-31',
  rollback: '移除 labs upstream session reference 路由、导航入口与对应页面。',
  exception: [] as string[],
} as const;
