// src/labs/student-course-results-pull/meta.ts

export const studentCourseResultsPullLabMeta = {
  name: 'student-course-results-pull',
  purpose:
    '验证按本地班级 classCode、学年和可选学期显式拉取学生课程成绩，并写入本地加密快照的业务链路。',
  owner: 'frontend',
  reviewAt: '2026-08-31',
  rollback: '移除 labs student-course-results-pull 路由、导航入口与对应页面。',
  exception: [
    '依赖登录态直连后端 listLocalClassOptions 与 fetchClassStudentCourseResults GraphQL 接口。',
  ],
} as const;
