// src/labs/student-registration-cards/index.ts
export { studentRegistrationCardsLabAccess } from './access';
export async function loadStudentRegistrationCardsLabRouteModule() {
  const { StudentRegistrationCardsLabPage } = await import('./ui/page');
  return { Component: StudentRegistrationCardsLabPage };
}
