import { useLoaderData } from 'react-router';

import { useAuthSessionState } from '@/features/auth';
import { SemesterCourseScheduleSyncPageContent } from '@/features/course-schedule-sync';
import { Error403 } from '@/features/error-feedback';

import { resolveUpstreamLoginLockedUserId } from '@/shared/auth-access';

export function SemesterCourseScheduleSyncPage() {
  const authSession = useAuthSessionState();
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;
  const snapshot = authSession.snapshot;
  const staffId = snapshot?.identity?.kind === 'STAFF' ? snapshot.identity.id : null;
  const lockedUpstreamLoginUserId = resolveUpstreamLoginLockedUserId({
    accessGroup: snapshot?.userInfo.accessGroup,
    slotGroup: snapshot?.slotGroup,
    staffId,
  });

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
    />
  );
}
