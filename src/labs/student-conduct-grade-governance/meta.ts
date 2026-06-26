// src/labs/student-conduct-grade-governance/meta.ts

export const studentConductGradeGovernanceLabMeta = {
  name: 'student-conduct-grade-governance',
  purpose: '验证班级学期操行等级有效视图、本地补正冲突观察与失效补正清理链路。',
  owner: 'frontend',
  reviewAt: '2026-09-30',
  rollback: '移除 labs student conduct grade governance 路由、导航入口、页面和实验 API。',
  exception: [] as string[],
} as const;
