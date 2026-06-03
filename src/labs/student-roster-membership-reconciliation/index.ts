// src/labs/student-roster-membership-reconciliation/index.ts

export { studentRosterMembershipReconciliationLabAccess } from './access';

export async function loadStudentRosterMembershipReconciliationLabRouteModule() {
  const { StudentRosterMembershipReconciliationLabPage } = await import('./page');

  return {
    Component: StudentRosterMembershipReconciliationLabPage,
  };
}
