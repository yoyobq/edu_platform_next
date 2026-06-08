// src/labs/zquiz-exam-activities/meta.ts

export const zquizExamActivitiesLabMeta = {
  name: 'zquiz-exam-activities',
  purpose: '验证学生侧考试列表、详情确认、开考、自动保存与交卷接口联调体验。',
  owner: 'frontend',
  reviewAt: '2026-07-31',
  rollback: '移除 labs zquiz exam activities 路由、导航入口与对应页面。',
  exception: ['依赖登录态直连后端 zquiz 学生考试列表、详情、开考、自动保存和交卷 GraphQL 接口。'],
} as const;
