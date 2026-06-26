// src/labs/student-conduct-grade-governance/index.ts

export { studentConductGradeGovernanceLabAccess } from './access';

export async function loadStudentConductGradeGovernanceLabRouteModule() {
  const { StudentConductGradeGovernanceLabPage } = await import('./page');

  return {
    Component: StudentConductGradeGovernanceLabPage,
  };
}
