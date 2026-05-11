// src/features/academic-workload/index.ts
export type {
  AcademicStableWorkloadCalcEffect,
  AcademicStableWorkloadEnvelope,
  AcademicStableWorkloadOccurrence,
  RequestAcademicStableWorkloadInput,
  RequestMyAcademicStableWorkloadInput,
} from './infrastructure/academic-workload-api';
export {
  requestAcademicStableWorkloadOccurrences,
  requestMyAcademicStableWorkloadOccurrences,
} from './infrastructure/academic-workload-api';
export {
  AcademicWorkloadPageContent,
  type AcademicWorkloadPageContentProps,
} from './ui/academic-workload-page-content';
