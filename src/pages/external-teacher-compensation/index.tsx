// src/pages/external-teacher-compensation/index.tsx
import { useLoaderData } from 'react-router';

import {
  ExternalTeacherCompensationPageContent,
  type ExternalTeacherCompensationPageContentProps,
} from '@/features/academic-workload';

export function ExternalTeacherCompensationPage() {
  const loaderData = useLoaderData() as ExternalTeacherCompensationPageContentProps | null;

  return (
    <ExternalTeacherCompensationPageContent
      canSelectWorkloadDepartment={loaderData?.canSelectWorkloadDepartment}
      defaultWorkloadDepartmentId={loaderData?.defaultWorkloadDepartmentId}
    />
  );
}
