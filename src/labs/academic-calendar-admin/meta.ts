export const academicCalendarAdminLabMeta = {
  name: 'academic-calendar-admin',
  purpose: '提供学期与校历事件的基础管理能力，便于 admin 与教务员直接联调 academic calendar 数据。',
  owner: 'frontend',
  reviewAt: '2026-05-21',
  rollback: '移除 labs academic calendar admin 路由、入口与对应页面。',
  exception: ['依赖登录态直连后端 academic semester / academic calendar event GraphQL CRUD。'],
} as const;
