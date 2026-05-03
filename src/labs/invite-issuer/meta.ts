export const inviteIssuerLabMeta = {
  name: 'invite-issuer',
  purpose:
    '提供临时邀请与老用户回归签发工具，便于生成 staff / student invite 链接，或按账号 ID 触发回归改密邮件进行联调。',
  owner: 'frontend',
  reviewAt: '2026-05-01',
  rollback: '移除 labs invite issuer 路由与对应页面。',
  exception: [
    '依赖登录态直连后端 inviteStaff / inviteStudent / adminRequestPasswordResetEmail mutation。',
  ],
} as const;
