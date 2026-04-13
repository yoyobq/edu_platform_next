export const myProfileLabMeta = {
  name: 'my-profile',
  purpose:
    '个人资料查看与安全设置临时页，用于联调 myProfileBasic / myProfileIdentity 接口与登录邮箱变更、密码重置流程。',
  owner: 'frontend',
  reviewAt: '2026-08-01',
  rollback: '移除 labs my-profile 路由与对应页面。',
  exception: [] as string[],
} as const;
