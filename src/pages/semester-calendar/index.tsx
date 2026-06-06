import { Skeleton } from 'antd';
import { useLoaderData } from 'react-router';

import {
  requestAcademicCalendarEvents,
  requestAcademicSemesters,
  requestStudentAcademicCalendarEvents,
  requestStudentAcademicSemesters,
  SemesterCalendarPageContent,
} from '@/features/academic-calendar-management';
import { useAuthSessionState } from '@/features/auth';
import { Error403 } from '@/features/error-feedback';

const STUDENT_CURRENT_SEMESTER_QUERY_INPUT = { isCurrent: true, limit: 1 } as const;

function isStudentCalendarSession(accessGroup: readonly string[]) {
  return (
    accessGroup.includes('STUDENT') &&
    !accessGroup.includes('ADMIN') &&
    !accessGroup.includes('STAFF')
  );
}

export function SemesterCalendarPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;
  const authSession = useAuthSessionState();
  const accessGroup = authSession.snapshot?.userInfo.accessGroup ?? [];
  const useStudentCalendar = isStudentCalendarSession(accessGroup);

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  if (authSession.status !== 'authenticated' || !authSession.snapshot) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  return (
    <SemesterCalendarPageContent
      emptySemestersDescription={useStudentCalendar ? '暂无当前学期校历' : undefined}
      listAcademicCalendarEvents={
        useStudentCalendar ? requestStudentAcademicCalendarEvents : requestAcademicCalendarEvents
      }
      listAcademicSemesters={
        useStudentCalendar ? requestStudentAcademicSemesters : requestAcademicSemesters
      }
      semesterQueryInput={useStudentCalendar ? STUDENT_CURRENT_SEMESTER_QUERY_INPUT : undefined}
      showEventManagementMetadata={!useStudentCalendar}
    />
  );
}
