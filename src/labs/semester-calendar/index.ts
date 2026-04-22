export { semesterCalendarLabAccess } from './access';

export async function loadSemesterCalendarLabRouteModule() {
  const { SemesterCalendarLabPage } = await import('./page');

  return {
    Component: SemesterCalendarLabPage,
  };
}
