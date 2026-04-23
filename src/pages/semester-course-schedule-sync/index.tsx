import { useLoaderData } from 'react-router';

import { useAuthSessionState } from '@/features/auth';
import { SemesterCourseScheduleSyncPageContent } from '@/features/course-schedule-sync';
import { Error403 } from '@/features/error-feedback';

export function SemesterCourseScheduleSyncPage() {
  const authSession = useAuthSessionState();
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <SemesterCourseScheduleSyncPageContent
      currentAccount={
        authSession.snapshot
          ? {
              accountId: authSession.snapshot.accountId,
              displayName: authSession.snapshot.displayName,
            }
          : null
      }
      isAuthenticating={authSession.status === 'restoring' || authSession.status === 'hydrating'}
    />
  );
}
