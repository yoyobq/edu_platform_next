// src/pages/integrated-plan-corrections/index.tsx
import { useLoaderData } from 'react-router';

import {
  AcademicIntegratedPlanCorrectionsPageContent,
  type AcademicIntegratedPlanCorrectionsPageLoaderData,
} from '@/features/academic-integrated-plan-corrections';

export function IntegratedPlanCorrectionsPage() {
  const loaderData = useLoaderData() as AcademicIntegratedPlanCorrectionsPageLoaderData;

  return (
    <AcademicIntegratedPlanCorrectionsPageContent
      defaultStaffId={loaderData?.defaultStaffId}
      lockedUpstreamLoginUserId={loaderData?.lockedUpstreamLoginUserId}
      upstreamAccount={loaderData?.upstreamAccount ?? null}
      viewerRole={loaderData?.viewerRole}
    />
  );
}
