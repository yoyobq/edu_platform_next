// src/pages/student-roster-membership-reconciliation/index.tsx

import { useLoaderData } from 'react-router';

import { refreshSession, useAuthSessionState } from '@/features/auth';
import { Error403 } from '@/features/error-feedback';
import { StudentRosterMembershipReconciliationPageContent } from '@/features/student-roster-membership-reconciliation';

import { resolveUpstreamLoginLockedUserId } from '@/shared/auth-access';

export function StudentRosterMembershipReconciliationPage() {
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
    <StudentRosterMembershipReconciliationPageContent
      accessGroup={snapshot?.userInfo.accessGroup}
      lockedUpstreamLoginUserId={lockedUpstreamLoginUserId}
      refreshSiteSession={async () => {
        await refreshSession();
      }}
      slotGroup={snapshot?.slotGroup}
    />
  );
}
