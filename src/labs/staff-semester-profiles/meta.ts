export const staffSemesterProfilesLabMeta = {
  name: 'staff-semester-profiles',
  purpose: '验证按学期分页查询教师学期教学画像，并按部门、教研组与聘任类型筛选教师归属。',
  owner: 'frontend',
  reviewAt: '2026-06-05',
  rollback: '移除 labs 教师学期归属路由、入口与相关只读页面。',
  exception: [] as string[],
} as const;
