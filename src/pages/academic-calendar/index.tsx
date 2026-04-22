import { useLoaderData } from 'react-router';

import {
  AcademicCalendarManagementPageContent,
  requestAcademicCalendarEventCreate,
  requestAcademicCalendarEventDelete,
  requestAcademicCalendarEvents,
  requestAcademicCalendarEventUpdate,
  requestAcademicSemesterCreate,
  requestAcademicSemesterDelete,
  requestAcademicSemesters,
  requestAcademicSemesterUpdate,
} from '@/features/academic-calendar-management';
import { Error403 } from '@/features/error-feedback';

export function AcademicCalendarPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <AcademicCalendarManagementPageContent
      createAcademicCalendarEvent={requestAcademicCalendarEventCreate}
      createAcademicSemester={requestAcademicSemesterCreate}
      deleteAcademicCalendarEvent={requestAcademicCalendarEventDelete}
      deleteAcademicSemester={requestAcademicSemesterDelete}
      listAcademicCalendarEvents={requestAcademicCalendarEvents}
      listAcademicSemesters={requestAcademicSemesters}
      updateAcademicCalendarEvent={requestAcademicCalendarEventUpdate}
      updateAcademicSemester={requestAcademicSemesterUpdate}
    />
  );
}
