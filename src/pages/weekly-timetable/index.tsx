// src/pages/weekly-timetable/index.tsx

import { useLoaderData } from 'react-router';

import {
  requestAcademicTeachingClassOptions,
  requestAcademicWeeklyTimetableItems,
  WeeklyTimetablePageContent,
} from '@/features/academic-timetable';
import { Error403 } from '@/features/error-feedback';

import { requestAcademicSemesters } from '@/entities/academic-semester';

export function WeeklyTimetablePage() {
  const loaderData = useLoaderData() as {
    defaultStaffId?: string | null;
    isForbidden?: boolean;
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
      upstreamAccount={loaderData?.upstreamAccount ?? null}
    />
  );
}
