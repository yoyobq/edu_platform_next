// src/labs/curriculum-plan-homepage/index.ts

export { curriculumPlanHomepageLabAccess } from './access';

export async function loadCurriculumPlanHomepageLabRouteModule() {
  const { CurriculumPlanHomepageLabPage } = await import('./page');

  return {
    Component: CurriculumPlanHomepageLabPage,
  };
}
