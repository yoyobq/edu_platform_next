// src/labs/academic-workload/index.ts
export { academicWorkloadLabAccess } from './access';

export async function loadAcademicWorkloadLabRouteModule() {
  const { AcademicWorkloadLabPage } = await import('./ui/page');

  return {
    Component: AcademicWorkloadLabPage,
  };
}
