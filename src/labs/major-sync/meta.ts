// src/labs/major-sync/meta.ts

export const majorSyncLabMeta = {
  name: 'major-sync',
  purpose: '预览从 upstream 专业字典同步到本地 org_major 的新增、已存在和重复跳过项。',
  owner: 'frontend',
  reviewAt: '2026-06-30',
  rollback: '移除 labs major sync 路由、导航入口与实验模块文件。',
  exception: [] as string[],
} as const;
