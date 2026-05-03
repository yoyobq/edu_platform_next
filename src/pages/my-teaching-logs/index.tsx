import { useLoaderData } from 'react-router';

import {
  AcademicTeachingLogPageContent,
  type AcademicTeachingLogPageLoaderData,
} from '@/features/academic-teaching-log';

const STAFF_LOCKED_UPSTREAM_LOGIN_HELP = '当前非管理员教职工只能使用本人 staffId 登录校园网。';

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
      lockedUpstreamLoginUserIdHelp={
        lockedUpstreamLoginUserId ? STAFF_LOCKED_UPSTREAM_LOGIN_HELP : undefined
      }
      upstreamAccount={loaderData?.upstreamAccount ?? null}
      viewerRole={viewerRole}
    />
  );
}
