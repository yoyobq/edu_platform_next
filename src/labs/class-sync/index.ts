// src/labs/class-sync/index.ts

export { classSyncLabAccess } from './access';

export async function loadClassSyncLabRouteModule() {
  const { ClassSyncLabPage } = await import('./page');

  return {
    Component: ClassSyncLabPage,
  };
}
