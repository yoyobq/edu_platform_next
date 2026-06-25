// src/pages/student-profile-filing/index.tsx

import { useLoaderData } from 'react-router';

import { Error403 } from '@/features/error-feedback';
import { StudentProfileFilingPageContent } from '@/features/student-profile-filing';

export function StudentProfileFilingPage() {
  const loaderData = useLoaderData() as {
    currentAccount?: {
      accountId: number;
      displayName: string;
      lockedUpstreamLoginUserId: string | null;
      staffId: string | null;
    };
    isForbidden?: boolean;
  } | null;

  if (loaderData?.isForbidden || !loaderData?.currentAccount) {
    return <Error403 />;
  }

  return <StudentProfileFilingPageContent currentAccount={loaderData.currentAccount} />;
}
