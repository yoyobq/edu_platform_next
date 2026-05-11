// src/labs/academic-workload-deduction-summary/index.ts

export { academicWorkloadDeductionSummaryLabAccess } from './access';

export async function loadAcademicWorkloadDeductionSummaryLabRouteModule() {
  const { AcademicWorkloadDeductionSummaryLabPage } = await import('./page');

  return {
    Component: AcademicWorkloadDeductionSummaryLabPage,
  };
}
