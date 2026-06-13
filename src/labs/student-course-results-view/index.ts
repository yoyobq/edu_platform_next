// src/labs/student-course-results-view/index.ts

export { studentCourseResultsViewLabAccess } from './access';

export async function loadStudentCourseResultsViewLabRouteModule() {
  const { StudentCourseResultsViewLabPage } = await import('./page');

  return {
    Component: StudentCourseResultsViewLabPage,
  };
}
