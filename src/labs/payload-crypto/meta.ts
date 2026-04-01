export const payloadCryptoLabMeta = {
  name: 'payload-crypto',
  purpose: '提供载荷加密/解密工具界面的快速验证',
  owner: 'frontend',
  reviewAt: '2026-05-01',
  rollback: '移除该工具页入口和路由',
  exception: ['依赖 @/features/auth 的公开内容来获取 token'],
} as const;
