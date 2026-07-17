// src/labs/student-evaluation-comment/index.ts

export { studentEvaluationCommentLabAccess } from './access';
export type { StudentEvaluationCommentLabLoaderData } from './types';

export async function loadStudentEvaluationCommentLabRouteModule() {
  const { StudentEvaluationCommentLabPage } = await import('./page');

  return {
    Component: StudentEvaluationCommentLabPage,
  };
}
