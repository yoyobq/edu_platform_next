import { useLoaderData } from 'react-router';

import {
  AcademicTeachingLogPageContent,
  type AcademicTeachingLogPageLoaderData,
} from '@/features/academic-teaching-log';

export function MyTeachingLogsPage() {
  const loaderData = useLoaderData() as AcademicTeachingLogPageLoaderData;
  const defaultStaffId = loaderData?.defaultStaffId ?? null;
  const viewerRole = loaderData?.viewerRole ?? 'authenticated';
  const lockedUpstreamLoginUserId =
    viewerRole === 'staff' && defaultStaffId ? defaultStaffId : null;

  return (
    <AcademicTeachingLogPageContent
      defaultStaffId={defaultStaffId}
      lockedUpstreamLoginUserId={lockedUpstreamLoginUserId}
      upstreamAccount={loaderData?.upstreamAccount ?? null}
      viewerRole={viewerRole}
    />
  );
}
