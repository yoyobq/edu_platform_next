export { myTeachingPlanLabAccess } from './access';
export type { MyTeachingPlanLabLoaderData } from './types';

export async function loadMyTeachingPlanLabRouteModule() {
  const { MyTeachingPlanLabPage } = await import('./page');

  return {
    Component: MyTeachingPlanLabPage,
  };
}
