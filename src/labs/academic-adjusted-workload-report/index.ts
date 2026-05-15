// src/labs/academic-adjusted-workload-report/index.ts

export { academicAdjustedWorkloadReportLabAccess } from './access';

export async function loadAcademicAdjustedWorkloadReportLabRouteModule() {
  const { AcademicAdjustedWorkloadReportLabPage } = await import('./page');

  return {
    Component: AcademicAdjustedWorkloadReportLabPage,
  };
}
