export { academicTimetableLabAccess } from './access';

export async function loadAcademicTimetableLabRouteModule() {
  const { AcademicTimetableLabPage } = await import('./page');

  return {
    Component: AcademicTimetableLabPage,
  };
}
