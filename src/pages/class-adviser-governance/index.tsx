// src/pages/class-adviser-governance/index.tsx

import { useLoaderData } from 'react-router';

import { ClassAdviserGovernancePageContent } from '@/features/class-adviser-governance';
import { Error403 } from '@/features/error-feedback';

import { type AuthAccessGroup, resolveUpstreamLoginLockedUserId } from '@/entities/auth-access';
import type { UpstreamAccountIdentity } from '@/entities/upstream-session';

type ClassAdviserGovernancePageLoaderData = {
  currentAccount?: UpstreamAccountIdentity;
  identityStaffId?: string | null;
  isForbidden?: boolean;
  slotGroup?: readonly string[];
  userAccessGroup?: readonly AuthAccessGroup[];
};

export function ClassAdviserGovernancePage() {
  const loaderData = useLoaderData() as ClassAdviserGovernancePageLoaderData | null;

  if (loaderData?.isForbidden || !loaderData?.currentAccount) {
    return <Error403 />;
  }

  return (
    <ClassAdviserGovernancePageContent
      currentAccount={loaderData.currentAccount}
      lockedUpstreamLoginUserId={resolveUpstreamLoginLockedUserId({
        accessGroup: loaderData.userAccessGroup,
        slotGroup: loaderData.slotGroup,
        staffId: loaderData.identityStaffId,
      })}
    />
  );
}
