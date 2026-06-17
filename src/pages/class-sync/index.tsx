// src/pages/class-sync/index.tsx

import { useLoaderData } from 'react-router';

import { useAuthSessionState } from '@/features/auth';
import { ClassSyncPageContent } from '@/features/class-sync';
import { Error403 } from '@/features/error-feedback';

import { resolveUpstreamLoginLockedUserId } from '@/entities/auth-access';

export function ClassSyncPage() {
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
    <ClassSyncPageContent
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
