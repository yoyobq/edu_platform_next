import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

type TeacherDirectoryResponse = {
  fetchTeacherDirectory: TeacherDirectoryResult;
};

type DepartmentOptionsResponse = {
  departments: LectureJournalDepartmentOption[];
};

type LectureJournalReconciliationResponse = {
  fetchLectureJournalReconciliation: LectureJournalReconciliationResult;
};

export type LectureJournalDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type TeacherDirectoryEntry = {
  code: string;
  image: string;
  name: string;
  text: string;
  value: string;
};

export type TeacherDirectoryResult = {
  expiresAt: string;
  teachers: TeacherDirectoryEntry[];
  upstreamSessionToken: string;
};

export type LectureJournalReconciliationStatus = 'FILLED' | 'MISSING' | 'UNMATCHED';

export type MatchedLectureJournalSummary = {
  courseContent: string | null;
  homeworkAssignment: string | null;
  lectureJournalDetailId: string | null;
  lectureJournalId: string | null;
  rawJournal: unknown;
  statusCode: string | null;
  statusName: string | null;
  topicRecord: string | null;
};

export type LectureJournalReconciliationItem = {
  courseCategory: string | null;
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  demonstrationHours: number | null;
  homework: string | null;
  journal: MatchedLectureJournalSummary | null;
  lectureHours: number | null;
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  lessonHours: number | null;
  matchKey: string | null;
  practiceHours: number | null;
  reason: string | null;
  schoolYear: string | null;
  sectionId: string | null;
  sectionName: string | null;
  semester: string | null;
  status: LectureJournalReconciliationStatus;
  teacherId: string | null;
  teacherName: string | null;
  teachingChapterContent: string | null;
  teachingClassId: string | null;
  teachingClassName: string | null;
  teachingDate: string | null;
  topicName: string | null;
  weekNumber: number | null;
};

export type MissingLectureJournalItem = {
  courseCategory: string | null;
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number;
  demonstrationHours: number | null;
  homework: string | null;
  lectureHours: number | null;
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  lessonHours: number;
  matchKey: string;
  practiceHours: number | null;
  schoolYear: string | null;
  sectionId: string;
  sectionName: string | null;
  semester: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teachingChapterContent: string | null;
  teachingClassId: string | null;
  teachingClassName: string | null;
  teachingDate: string;
  topicName: string | null;
  weekNumber: number;
};

export type UnmatchedLectureJournalPlanItem = {
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  rawPlan: unknown;
  rawPlanDetail: unknown;
  reason: string;
  teachingClassId: string | null;
};

export type LectureJournalReconciliationResult = {
  expiresAt: string;
  filledCount: number;
  items: LectureJournalReconciliationItem[];
  journalCount: number;
  missingCount: number;
  missingItems: MissingLectureJournalItem[];
  planCount: number;
  planDetailCount: number;
  unmatchedPlanItemCount: number;
  unmatchedPlanItems: UnmatchedLectureJournalPlanItem[];
  upstreamSessionToken: string;
};

export type FetchLectureJournalReconciliationInput = {
  departmentId?: string;
  schoolYear: string;
  semester: string;
  sessionToken: string;
  staffId?: string;
};

const FETCH_TEACHER_DIRECTORY_QUERY = `
  query FetchTeacherDirectory($sessionToken: String!) {
    fetchTeacherDirectory(sessionToken: $sessionToken) {
      expiresAt
      teachers {
        code
        image
        name
        text
        value
      }
      upstreamSessionToken
    }
  }
`;

const DEPARTMENTS_QUERY = `
  query LectureJournalReconciliationDepartments($isEnabled: Boolean, $limit: Int) {
    departments(isEnabled: $isEnabled, limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

const FETCH_LECTURE_JOURNAL_RECONCILIATION_QUERY = `
  query FetchLectureJournalReconciliation(
    $departmentId: String
    $schoolYear: String!
    $semester: String!
    $sessionToken: String!
    $staffId: String
  ) {
    fetchLectureJournalReconciliation(
      departmentId: $departmentId
      schoolYear: $schoolYear
      semester: $semester
      sessionToken: $sessionToken
      staffId: $staffId
    ) {
      expiresAt
      filledCount
      items {
        courseCategory
        courseContent
        courseId
        courseName
        dayOfWeek
        demonstrationHours
        homework
        journal {
          courseContent
          homeworkAssignment
          lectureJournalDetailId
          lectureJournalId
          rawJournal
          statusCode
          statusName
          topicRecord
        }
        lectureHours
        lecturePlanDetailId
        lecturePlanId
        lessonHours
        matchKey
        practiceHours
        reason
        schoolYear
        sectionId
        sectionName
        semester
        status
        teacherId
        teacherName
        teachingChapterContent
        teachingClassId
        teachingClassName
        teachingDate
        topicName
        weekNumber
      }
      journalCount
      missingCount
      missingItems {
        courseCategory
        courseContent
        courseId
        courseName
        dayOfWeek
        demonstrationHours
        homework
        lectureHours
        lecturePlanDetailId
        lecturePlanId
        lessonHours
        matchKey
        practiceHours
        schoolYear
        sectionId
        sectionName
        semester
        teacherId
        teacherName
        teachingChapterContent
        teachingClassId
        teachingClassName
        teachingDate
        topicName
        weekNumber
      }
      planCount
      planDetailCount
      unmatchedPlanItemCount
      unmatchedPlanItems {
        lecturePlanDetailId
        lecturePlanId
        rawPlan
        rawPlanDetail
        reason
        teachingClassId
      }
      upstreamSessionToken
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function normalizeOptionalString(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeFetchLectureJournalReconciliationInput(
  input: FetchLectureJournalReconciliationInput,
) {
  const departmentId = normalizeOptionalString(input.departmentId);
  const staffId = normalizeOptionalString(input.staffId);

  if ((departmentId && !staffId) || (!departmentId && staffId)) {
    throw new Error('departmentId 和 staffId 需要同时传入，或同时留空。');
  }

  return {
    departmentId,
    schoolYear: String(input.schoolYear || '').trim(),
    semester: String(input.semester || '').trim(),
    sessionToken: input.sessionToken,
    staffId,
  };
}

export async function fetchTeacherDirectory(input: { sessionToken: string }) {
  const response = await requestGraphQL<
    TeacherDirectoryResponse,
    {
      sessionToken: string;
    }
  >(FETCH_TEACHER_DIRECTORY_QUERY, {
    sessionToken: input.sessionToken,
  });

  return response.fetchTeacherDirectory;
}

export async function fetchLectureJournalDepartmentOptions() {
  try {
    const response = await requestGraphQL<
      DepartmentOptionsResponse,
      {
        isEnabled: boolean;
        limit: number;
      }
    >(DEPARTMENTS_QUERY, {
      isEnabled: true,
      limit: 500,
    });

    return response.departments;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载院系列表。'));
  }
}

export async function fetchLectureJournalReconciliation(
  input: FetchLectureJournalReconciliationInput,
) {
  try {
    const response = await requestGraphQL<
      LectureJournalReconciliationResponse,
      FetchLectureJournalReconciliationInput & {
        departmentId?: string;
        staffId?: string;
      }
    >(
      FETCH_LECTURE_JOURNAL_RECONCILIATION_QUERY,
      normalizeFetchLectureJournalReconciliationInput(input),
    );

    return response.fetchLectureJournalReconciliation;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载教学日志对账结果。'));
  }
}
