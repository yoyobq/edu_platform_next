// src/labs/zquiz-exam-activities/index.ts

export { zquizExamActivitiesLabAccess } from './access';

export async function loadZquizExamActivitiesLabRouteModule() {
  const { ZquizExamActivitiesLabPage } = await import('./page');

  return {
    Component: ZquizExamActivitiesLabPage,
  };
}

export async function loadZquizExamPaperLabRouteModule() {
  const { ZquizExamPaperLabPage } = await import('./page');

  return {
    Component: ZquizExamPaperLabPage,
  };
}
