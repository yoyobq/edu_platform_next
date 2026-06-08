// src/labs/zquiz-activity-builder/meta.ts

export const zquizActivityBuilderLabMeta = {
  name: 'zquiz-activity-builder',
  purpose: '验证教师侧 zquiz 练习与考试创建、编辑、组卷和发布链路。',
  owner: 'frontend',
  reviewAt: '2026-07-31',
  rollback: '移除 labs zquiz activity builder 路由、导航入口与对应页面。',
  exception: [
    '依赖登录态直连后端 zquiz 教师侧题库、活动列表、组卷、保存草稿、发布和详情 GraphQL 接口。',
  ],
} as const;
