export const changeLoginEmailLabMeta = {
  name: 'change-login-email',
  purpose: '提供临时登录邮箱变更发信入口，便于联调 requestChangeLoginEmail 与 verify/email 闭环。',
  owner: 'frontend',
  reviewAt: '2026-05-01',
  rollback: '移除 labs change-login-email 路由与对应页面。',
  exception: [],
} as const;
