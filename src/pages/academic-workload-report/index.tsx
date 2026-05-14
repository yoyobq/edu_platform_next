// src/pages/academic-workload-report/index.tsx
import { useLoaderData } from 'react-router';

import {
  AcademicWorkloadReportPageContent,
  type AcademicWorkloadReportPageContentProps,
} from '@/features/academic-workload';

export function AcademicWorkloadReportPage() {
  const loaderData = useLoaderData() as AcademicWorkloadReportPageContentProps | null;

  return (
    <AcademicWorkloadReportPageContent
      canSelectWorkloadDepartment={loaderData?.canSelectWorkloadDepartment}
      defaultWorkloadDepartmentId={loaderData?.defaultWorkloadDepartmentId}
    />
  );
}
