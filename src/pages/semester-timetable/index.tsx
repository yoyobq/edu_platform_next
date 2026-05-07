import { useLoaderData } from 'react-router';

import {
  requestAcademicTeacherSemesterScheduleItems,
  requestMyAcademicTeacherSemesterScheduleItems,
  SemesterTimetablePageContent,
} from '@/features/academic-timetable';
import { Error403 } from '@/features/error-feedback';

import { requestAcademicSemesters } from '@/entities/academic-semester';

export function SemesterTimetablePage() {
  const loaderData = useLoaderData() as {
    defaultStaffId?: string | null;
    isForbidden?: boolean;
    viewerRole?: 'admin' | 'staff';
  } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <SemesterTimetablePageContent
      defaultStaffId={loaderData?.defaultStaffId}
      listAcademicSemesters={requestAcademicSemesters}
      listAcademicTeacherSemesterScheduleItems={requestAcademicTeacherSemesterScheduleItems}
      listMyAcademicTeacherSemesterScheduleItems={requestMyAcademicTeacherSemesterScheduleItems}
      viewerRole={loaderData?.viewerRole}
    />
  );
}
