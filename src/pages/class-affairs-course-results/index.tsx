// src/pages/class-affairs-course-results/index.tsx

import { useLoaderData } from 'react-router';

import { ClassAffairsCourseResultsPageContent } from '@/features/class-affairs-course-results';
import { Error403 } from '@/features/error-feedback';

export function ClassAffairsCourseResultsPage() {
  const loaderData = useLoaderData() as {
    currentAccount?: {
      accountId: number;
      displayName: string;
      staffId: string | null;
    };
    isForbidden?: boolean;
  } | null;

  if (loaderData?.isForbidden || !loaderData?.currentAccount) {
    return <Error403 />;
  }

  return <ClassAffairsCourseResultsPageContent currentAccount={loaderData.currentAccount} />;
}
