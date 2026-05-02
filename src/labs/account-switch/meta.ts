export const accountSwitchLabMeta = {
  name: 'account-switch',
  purpose: '提供 staff/admin 可访问的前端账号切换实验入口，验证添加账号与双账号切换流程。',
  owner: 'frontend',
  reviewAt: '2026-05-16',
  rollback: '移除 labs account-switch 路由、入口与本地存储。',
  exception: [] as string[],
} as const;
