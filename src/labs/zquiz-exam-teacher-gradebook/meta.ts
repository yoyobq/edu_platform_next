// src/labs/zquiz-exam-teacher-gradebook/meta.ts

export const zquizExamTeacherGradebookLabMeta = {
  name: 'zquiz-exam-teacher-gradebook',
  purpose: '验证教师侧 zquiz 考试成绩单与按题分析查询接口联调体验。',
  owner: 'frontend',
  reviewAt: '2026-07-31',
  rollback: '移除 labs zquiz exam teacher gradebook 路由、导航入口与对应页面。',
  exception: ['依赖登录态直连后端 zquiz 教师考试成绩单与按题分析 GraphQL 接口。'],
} as const;
