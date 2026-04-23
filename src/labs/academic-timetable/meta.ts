export const academicTimetableLabMeta = {
  name: 'academic-timetable',
  purpose:
    '验证后端扁平课表项接口在前端直接排版成学期总览与单周课表的体验，不再在前端拼接 schedule 与 slot。',
  owner: 'frontend',
  reviewAt: '2026-05-24',
  rollback: '移除 labs 课表视图路由、入口与相关只读页面。',
  exception: [] as string[],
} as const;
