// src/pages/academic-workload-deduction-summary/index.tsx
import { useLoaderData } from 'react-router';

import {
  AcademicWorkloadDeductionSummaryPageContent,
  type AcademicWorkloadDeductionSummaryPageContentProps,
} from '@/features/academic-workload';

export function AcademicWorkloadDeductionSummaryPage() {
  const loaderData = useLoaderData() as AcademicWorkloadDeductionSummaryPageContentProps | null;

  return (
    <AcademicWorkloadDeductionSummaryPageContent
      canSelectWorkloadDepartment={loaderData?.canSelectWorkloadDepartment}
      defaultWorkloadDepartmentId={loaderData?.defaultWorkloadDepartmentId}
    />
  );
}
