// src/labs/teaching-inspection/index.ts
export { teachingInspectionLabAccess } from './access';
export async function loadTeachingInspectionLabRouteModule() {
  const { TeachingInspectionPage } = await import('./page');
  return { Component: TeachingInspectionPage };
}
