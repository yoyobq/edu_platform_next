// src/labs/zquiz-practice-activities/index.ts

export { zquizPracticeActivitiesLabAccess } from './access';

export async function loadZquizPracticeActivitiesLabRouteModule() {
  const { ZquizPracticeActivitiesLabPage } = await import('./page');

  return {
    Component: ZquizPracticeActivitiesLabPage,
  };
}
