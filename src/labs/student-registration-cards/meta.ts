// src/labs/student-registration-cards/meta.ts
export const studentRegistrationCardsLabMeta = {
  name: 'student-registration-cards',
  purpose: '验证班级选人、最终材料预检和单张及当前班级批量学籍卡生成下载；不替代建档治理。',
  owner: 'frontend',
  // 2026-11-06 复查：保留 Lab，延期一个月观察单人及批量出卡流程。
  reviewAt: '2026-12-06',
  rollback: '移除 lab 路由注册及 Labs 菜单入口；不影响已有建档、操行、评语及后端事实。',
} as const;
