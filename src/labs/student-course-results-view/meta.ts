// src/labs/student-course-results-view/meta.ts

export const studentCourseResultsViewLabMeta = {
  name: 'student-course-results-view',
  purpose:
    '验证按本地班级 classCode 展示学生课程成绩快照，默认只读取本地缓存且不主动访问 upstream。',
  owner: 'frontend',
  reviewAt: '2026-08-31',
  rollback: '移除 labs student-course-results-view 路由、导航入口与对应页面。',
  exception: [
    '依赖登录态直连后端 listLocalClassOptions 与 fetchClassStudentCourseResults GraphQL 接口。',
  ],
} as const;
