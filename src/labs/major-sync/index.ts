// src/labs/major-sync/index.ts

export { majorSyncLabAccess } from './access';

export async function loadMajorSyncLabRouteModule() {
  const { MajorSyncLabPage } = await import('./page');

  return {
    Component: MajorSyncLabPage,
  };
}
