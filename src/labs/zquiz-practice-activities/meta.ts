// src/labs/zquiz-practice-activities/meta.ts

export const zquizPracticeActivitiesLabMeta = {
  name: 'zquiz-practice-activities',
  purpose: '验证学生侧可选练习列表、状态展示与开始练习接口联调体验。',
  owner: 'frontend',
  reviewAt: '2026-07-31',
  rollback: '移除 labs zquiz practice activities 路由、导航入口与对应页面。',
  exception: [
    '依赖登录态直连后端 listMyZquizPracticeActivities query 与 startZquizPractice mutation。',
  ],
} as const;
