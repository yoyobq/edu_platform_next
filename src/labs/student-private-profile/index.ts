// src/labs/student-private-profile/index.ts

export { studentPrivateProfileLabAccess } from './access';

export async function loadStudentPrivateProfileLabRouteModule() {
  const { StudentPrivateProfileLabPage } = await import('./page');

  return {
    Component: StudentPrivateProfileLabPage,
  };
}
