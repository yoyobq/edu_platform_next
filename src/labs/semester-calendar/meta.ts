export const semesterCalendarLabMeta = {
  name: 'semester-calendar',
  purpose: '验证按学期浏览校历的真实阅读体验，作为只读事实工作台，不承接待办或编辑闭环。',
  owner: 'frontend',
  reviewAt: '2026-05-22',
  rollback: '移除 labs 学期校历路由、入口与相关只读页面。',
  exception: [] as string[],
} as const;
