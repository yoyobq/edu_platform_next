import { useLoaderData } from 'react-router';

import { useAuthSessionState } from '@/features/auth';
import { Error403 } from '@/features/error-feedback';
import { VerificationIssuancePageContent } from '@/features/verification-issuance';

const STAFF_LOCKED_UPSTREAM_LOGIN_HELP = '当前非管理员教职工只能使用本人 staffId 登录校园网。';

export function VerificationIssuancePage() {
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
    <VerificationIssuancePageContent
      lockedUpstreamLoginUserId={lockedUpstreamLoginUserId}
      lockedUpstreamLoginUserIdHelp={
        lockedUpstreamLoginUserId ? STAFF_LOCKED_UPSTREAM_LOGIN_HELP : undefined
      }
    />
  );
}
