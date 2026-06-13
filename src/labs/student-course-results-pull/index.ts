// src/labs/student-course-results-pull/index.ts

export { studentCourseResultsPullLabAccess } from './access';

export async function loadStudentCourseResultsPullLabRouteModule() {
  const { StudentCourseResultsPullLabPage } = await import('./page');

  return {
    Component: StudentCourseResultsPullLabPage,
  };
}
