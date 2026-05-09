// src/pages/staff-semester-profiles/index.tsx
import { useLoaderData } from 'react-router';

import {
  StaffSemesterProfilesPageContent,
  type StaffSemesterProfilesViewerRole,
} from '@/features/staff-semester-profiles';

type StaffSemesterProfilesPageLoaderData = {
  defaultDepartmentId?: string | null;
  viewerRole?: StaffSemesterProfilesViewerRole;
} | null;

export function StaffSemesterProfilesPage() {
  const loaderData = useLoaderData() as StaffSemesterProfilesPageLoaderData;

  return (
    <StaffSemesterProfilesPageContent
      defaultDepartmentId={loaderData?.defaultDepartmentId}
      viewerRole={loaderData?.viewerRole}
    />
  );
}
