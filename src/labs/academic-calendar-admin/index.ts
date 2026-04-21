export { academicCalendarAdminLabAccess, hasAcademicCalendarAdminLabAccess } from './access';

export async function loadAcademicCalendarAdminLabRouteModule() {
  const { AcademicCalendarAdminLabPage } = await import('./page');

  return {
    Component: AcademicCalendarAdminLabPage,
  };
}
