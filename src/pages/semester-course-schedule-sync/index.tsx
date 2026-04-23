import { useLoaderData } from 'react-router';

import { SemesterCourseScheduleSyncPageContent } from '@/features/course-schedule-sync';
import { Error403 } from '@/features/error-feedback';

export function SemesterCourseScheduleSyncPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return <SemesterCourseScheduleSyncPageContent />;
}
