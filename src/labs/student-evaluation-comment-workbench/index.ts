// src/labs/student-evaluation-comment-workbench/index.ts

export { studentEvaluationCommentWorkbenchLabAccess } from './access';
export type { StudentEvaluationCommentWorkbenchLoaderData } from './types';

export async function loadStudentEvaluationCommentWorkbenchLabRouteModule() {
  const { StudentEvaluationCommentWorkbenchLabPage } = await import('./page');

  return {
    Component: StudentEvaluationCommentWorkbenchLabPage,
  };
}
