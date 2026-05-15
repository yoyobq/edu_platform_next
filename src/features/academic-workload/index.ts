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
export type {
  AcademicAdjustedWorkloadReportEnvelope,
  AcademicAdjustedWorkloadReportItem,
  AcademicAdjustedWorkloadReportTotal,
  RequestAcademicAdjustedWorkloadReportInput,
} from './infrastructure/external-teacher-compensation-api';
export { requestAcademicAdjustedWorkloadReport } from './infrastructure/external-teacher-compensation-api';
export {
  AcademicWorkloadDeductionSummaryPageContent,
  type AcademicWorkloadDeductionSummaryPageContentProps,
} from './ui/academic-workload-deduction-summary-page-content';
export {
  AcademicWorkloadPageContent,
  type AcademicWorkloadPageContentProps,
} from './ui/academic-workload-page-content';
export {
  AcademicWorkloadReportPageContent,
  type AcademicWorkloadReportPageContentProps,
} from './ui/academic-workload-report-page-content';
export {
  ExternalTeacherCompensationPageContent,
  type ExternalTeacherCompensationPageContentProps,
} from './ui/external-teacher-compensation-page-content';
