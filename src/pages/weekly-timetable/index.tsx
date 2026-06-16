// src/pages/weekly-timetable/index.tsx

import { useLoaderData } from 'react-router';

import {
  requestAcademicSemesters,
  requestAcademicTeachingClassOptions,
  requestAcademicWeeklyTimetableItems,
  WeeklyTimetablePageContent,
} from '@/features/academic-timetable';
import { Error403 } from '@/features/error-feedback';

export function WeeklyTimetablePage() {
  const loaderData = useLoaderData() as {
    defaultStaffId?: string | null;
    isForbidden?: boolean;
    lockedUpstreamLoginUserId?: string | null;
    upstreamAccount?: {
      accountId: number;
      displayName: string;
    } | null;
  } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <WeeklyTimetablePageContent
      defaultStaffId={loaderData?.defaultStaffId}
      listAcademicSemesters={requestAcademicSemesters}
      listAcademicTeachingClassOptions={requestAcademicTeachingClassOptions}
      listAcademicWeeklyTimetableItems={requestAcademicWeeklyTimetableItems}
      lockedUpstreamLoginUserId={loaderData?.lockedUpstreamLoginUserId}
      upstreamAccount={loaderData?.upstreamAccount ?? null}
    />
  );
}
