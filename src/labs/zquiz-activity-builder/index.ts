// src/labs/zquiz-activity-builder/index.ts

export { zquizActivityBuilderLabAccess } from './access';

export async function loadZquizActivityBuilderLabRouteModule() {
  const { ZquizActivityBuilderLabPage } = await import('./page');

  return {
    Component: ZquizActivityBuilderLabPage,
  };
}
