// src/pages/student-roster-membership-reconciliation/index.tsx

import { useLoaderData } from 'react-router';

import { refreshSession, useAuthSessionState } from '@/features/auth';
import { Error403 } from '@/features/error-feedback';
import { StudentRosterMembershipReconciliationPageContent } from '@/features/student-roster-membership-reconciliation';

export function StudentRosterMembershipReconciliationPage() {
  const authSession = useAuthSessionState();
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;
  const snapshot = authSession.snapshot;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <StudentRosterMembershipReconciliationPageContent
      accessGroup={snapshot?.userInfo.accessGroup}
      refreshSiteSession={async () => {
        await refreshSession();
      }}
      slotGroup={snapshot?.slotGroup}
    />
  );
}
