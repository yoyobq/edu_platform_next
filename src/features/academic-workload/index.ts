// src/features/academic-workload/index.ts
export type {
  AcademicStableWorkloadCalcEffect,
  AcademicStableWorkloadEnvelope,
  AcademicStableWorkloadOccurrence,
  AcademicTeacherEngagementType,
  AcademicWorkloadDepartmentOption,
  AcademicWorkloadReportEnvelope,
  AcademicWorkloadReportItem,
  AcademicWorkloadReportTotal,
  RequestAcademicStableWorkloadInput,
  RequestAcademicWorkloadReportInput,
  RequestMyAcademicStableWorkloadInput,
} from './infrastructure/academic-workload-api';
export {
  requestAcademicStableWorkloadOccurrences,
  requestAcademicWorkloadDepartmentOptions,
  requestAcademicWorkloadReport,
  requestMyAcademicStableWorkloadOccurrences,
} from './infrastructure/academic-workload-api';
export {
  AcademicWorkloadPageContent,
  type AcademicWorkloadPageContentProps,
} from './ui/academic-workload-page-content';
export {
  AcademicWorkloadReportPageContent,
  type AcademicWorkloadReportPageContentProps,
} from './ui/academic-workload-report-page-content';
