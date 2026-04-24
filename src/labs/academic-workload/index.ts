export { academicWorkloadLabAccess } from './access';

export async function loadAcademicWorkloadLabRouteModule() {
  const { AcademicWorkloadLabPage } = await import('./page');

  return {
    Component: AcademicWorkloadLabPage,
  };
}
