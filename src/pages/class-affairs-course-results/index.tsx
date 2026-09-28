// src/pages/class-affairs-course-results/index.tsx

import { useLoaderData } from 'react-router';

import { ClassAffairsCourseResultsPageContent } from '@/features/class-affairs-course-results';
import { Error403 } from '@/features/error-feedback';

import { ClassWorkEntry } from '@/entities/class-work-context';

export function ClassAffairsCourseResultsPage() {
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

  return (
    <ClassWorkEntry>
      {({ key, scope }) => (
        <ClassAffairsCourseResultsPageContent
          key={key}
          currentAccount={loaderData.currentAccount!}
          initialScope={scope}
        />
      )}
    </ClassWorkEntry>
  );
}
