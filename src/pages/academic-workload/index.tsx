// src/pages/academic-workload/index.tsx
import { useLoaderData } from 'react-router';

import {
  AcademicWorkloadPageContent,
  type AcademicWorkloadPageContentProps,
} from '@/features/academic-workload';

export function AcademicWorkloadPage() {
  const loaderData = useLoaderData() as AcademicWorkloadPageContentProps | null;

  return (
    <AcademicWorkloadPageContent
      canManageWorkload={loaderData?.canManageWorkload}
      defaultStaffId={loaderData?.defaultStaffId}
      upstreamAccount={loaderData?.upstreamAccount ?? null}
    />
  );
}
