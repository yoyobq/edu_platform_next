export { staffSemesterProfilesLabAccess } from './access';

export async function loadStaffSemesterProfilesLabRouteModule() {
  const { StaffSemesterProfilesLabPage } = await import('./page');

  return {
    Component: StaffSemesterProfilesLabPage,
  };
}
