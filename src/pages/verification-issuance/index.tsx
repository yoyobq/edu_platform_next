import { useLoaderData } from 'react-router';

import { useAuthSessionState } from '@/features/auth';
import { Error403 } from '@/features/error-feedback';
import { VerificationIssuancePageContent } from '@/features/verification-issuance';

import { resolveUpstreamLoginLockedUserId } from '@/entities/auth-access';

export function VerificationIssuancePage() {
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

  return <VerificationIssuancePageContent lockedUpstreamLoginUserId={lockedUpstreamLoginUserId} />;
}
