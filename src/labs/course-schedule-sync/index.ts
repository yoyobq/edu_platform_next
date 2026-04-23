export { courseScheduleSyncLabAccess } from './access';

export async function loadCourseScheduleSyncLabRouteModule() {
  const { CourseScheduleSyncLabPage } = await import('./page');

  return {
    Component: CourseScheduleSyncLabPage,
  };
}
