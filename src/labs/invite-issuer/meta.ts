export const inviteIssuerLabMeta = {
  name: 'invite-issuer',
  purpose: '提供临时邀请签发工具，便于直接生成 staff / student invite 链接进行联调。',
  owner: 'frontend',
  reviewAt: '2026-05-01',
  rollback: '移除 labs invite issuer 路由与对应页面。',
  exception: ['依赖登录态直连后端 inviteStaff / inviteStudent mutation。'],
} as const;
