import { useLoaderData } from 'react-router';

import {
  AcademicTeachingLogPageContent,
  type AcademicTeachingLogPageLoaderData,
} from '@/features/academic-teaching-log';

export function MyTeachingLogsPage() {
  const loaderData = useLoaderData() as AcademicTeachingLogPageLoaderData;
  const defaultStaffId = loaderData?.defaultStaffId ?? null;
  const viewerRole = loaderData?.viewerRole ?? 'authenticated';

  return (
    <AcademicTeachingLogPageContent
      defaultStaffId={defaultStaffId}
      lockedUpstreamLoginUserId={loaderData?.lockedUpstreamLoginUserId ?? null}
      upstreamAccount={loaderData?.upstreamAccount ?? null}
      viewerRole={viewerRole}
    />
  );
}
