import { useLoaderData } from 'react-router';

import {
  requestAcademicCalendarEvents,
  requestAcademicSemesters,
  SemesterCalendarPageContent,
} from '@/features/academic-calendar-management';
import { Error403 } from '@/features/error-feedback';

export function SemesterCalendarPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <SemesterCalendarPageContent
      listAcademicCalendarEvents={requestAcademicCalendarEvents}
      listAcademicSemesters={requestAcademicSemesters}
    />
  );
}
