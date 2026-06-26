// src/labs/admin-class-adviser-governance/meta.ts

export const adminClassAdviserGovernanceLabMeta = {
  name: 'admin-class-adviser-governance',
  purpose: '验证 admin 补齐本地学生归属班级的班主任任职事实链路。',
  owner: 'frontend',
  reviewAt: '2026-09-30',
  rollback: '移除 labs admin-class-adviser-governance 路由、导航入口与对应页面。',
  exception: [
    '依赖登录态直连后端 departments、fetchTeacherDirectory、listClassAdviserGovernanceClasses 与 assignClassAdviserByStaffId GraphQL 接口。',
  ],
} as const;
