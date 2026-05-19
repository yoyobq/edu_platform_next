// src/labs/class-sync/meta.ts

export const classSyncLabMeta = {
  name: 'class-sync',
  purpose: '预览从 upstream 班级列表同步到本地 org_class 的新增、更新、已存在和冲突项。',
  owner: 'frontend',
  reviewAt: '2026-06-30',
  rollback: '移除 labs class sync 路由、导航入口与实验模块文件。',
  exception: [] as string[],
} as const;
