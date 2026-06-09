// src/labs/zquiz-exam-teacher-gradebook/index.ts

export { zquizExamTeacherGradebookLabAccess } from './access';

export async function loadZquizExamTeacherGradebookLabRouteModule() {
  const { ZquizExamTeacherGradebookLabPage } = await import('./page');

  return {
    Component: ZquizExamTeacherGradebookLabPage,
  };
}
