export const integratedPlanCorrectionsLabMeta = {
  name: 'integrated-plan-corrections',
  purpose:
    '验证一体化教学计划当前计划与真实应有计划的逐行对齐诊断体验，repairGroups 只作为连续异常辅助视图。',
  owner: 'frontend',
  reviewAt: '2026-05-24',
  rollback: '移除 labs 一体化计划修正建议路由、入口与相关只读页面。',
  exception: [] as string[],
} as const;
