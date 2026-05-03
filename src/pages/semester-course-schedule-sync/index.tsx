import { useLoaderData } from 'react-router';

import { useAuthSessionState } from '@/features/auth';
import { SemesterCourseScheduleSyncPageContent } from '@/features/course-schedule-sync';
import { Error403 } from '@/features/error-feedback';

const STAFF_LOCKED_UPSTREAM_LOGIN_HELP = '当前非管理员教职工只能使用本人 staffId 登录校园网。';

export function SemesterCourseScheduleSyncPage() {
  const authSession = useAuthSessionState();
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;
  const snapshot = authSession.snapshot;
  const isAdmin = snapshot?.userInfo.accessGroup.includes('ADMIN') === true;
  const staffId = snapshot?.identity?.kind === 'STAFF' ? snapshot.identity.id : null;
  const lockedUpstreamLoginUserId = !isAdmin ? staffId : null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <SemesterCourseScheduleSyncPageContent
      currentAccount={
        snapshot
          ? {
              accountId: snapshot.accountId,
              displayName: snapshot.displayName,
            }
          : null
      }
      isAuthenticating={authSession.status === 'restoring' || authSession.status === 'hydrating'}
      lockedUpstreamLoginUserId={lockedUpstreamLoginUserId}
      lockedUpstreamLoginUserIdHelp={
        lockedUpstreamLoginUserId ? STAFF_LOCKED_UPSTREAM_LOGIN_HELP : undefined
      }
    />
  );
}
