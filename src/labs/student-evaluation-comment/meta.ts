// src/labs/student-evaluation-comment/meta.ts

export const studentEvaluationCommentLabMeta = {
  name: 'student-evaluation-comment',
  purpose:
    '验证正式学期/毕业评语的班级批量编辑、Excel 草稿导入、学期 AI 加密草稿确认、CAS 冲突恢复与学生本人只读链路。',
  owner: 'frontend',
  reviewAt: '2026-09-30',
  rollback: '移除 student-evaluation-comment lab 的路由、导航和模块目录。',
  exception: [] as string[],
} as const;
