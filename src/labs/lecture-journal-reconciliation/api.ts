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

type AcademicTeachingLogPrefillResponse = {
  listAcademicTeachingLogPrefillItems: AcademicTeachingLogPrefillResult;
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

export type LectureJournalExpectedOccurrence = {
  date: string;
  dayOfWeek: number;
  lessonHours: number;
  periodEnd: number;
  periodStart: number;
  weekNumber: number;
};

export type AcademicIntegratedTeachingLogPrefillPreview = {
  blockingIssue: string | null;
  canFill: boolean;
  completeAndSummary: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  disciplineSituation: string | null;
  expectedOccurrences: LectureJournalExpectedOccurrence[];
  learningSessionContent: string | null;
  learningSessionNo: number | null;
  learningSessionTarget: string | null;
  learningTaskName: string | null;
  learningTaskNo: number | null;
  learningTaskText: string | null;
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  lessonHours: number | null;
  matchedLectureJournalDetailId: string | null;
  problemAndSolve: string | null;
  securityAndMaintain: string | null;
  shift: string | null;
  status: LectureJournalReconciliationStatus;
  teachingClassId: string | null;
  teachingClassName: string | null;
  teachingDate: string | null;
  teachingUnitAchievement: string | null;
  teachingUnitContent: string | null;
  teachingUnitName: string | null;
  teachingUnitNo: number | null;
  teachingUnitTarget: string | null;
  teachingUnitText: string | null;
  warnings: string[];
  weekNumber: number | null;
};

export type LectureJournalReconciliationItem = {
  blockingIssue: string | null;
  canFill: boolean;
  courseCategory: string | null;
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  demonstrationHours: number | null;
  expectedOccurrences: LectureJournalExpectedOccurrence[];
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
  warnings: string[];
  weekNumber: number | null;
};

export type MissingLectureJournalItem = {
  blockingIssue: string | null;
  canFill: boolean;
  courseCategory: string | null;
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number;
  demonstrationHours: number | null;
  expectedOccurrences: LectureJournalExpectedOccurrence[];
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
  warnings: string[];
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

export type AcademicTeachingLogPrefillResult = {
  blockingIssue: string | null;
  canFill: boolean;
  expiresAt: string | null;
  integratedPreviews: AcademicIntegratedTeachingLogPrefillPreview[];
  upstreamSessionToken: string | null;
  warnings: string[];
};

export type FetchLectureJournalReconciliationInput = {
  departmentId?: string;
  schoolYear: string;
  semester: string;
  sessionToken: string;
  staffId?: string;
};

export type FetchAcademicTeachingLogPrefillInput = {
  departmentId?: string;
  semesterId: number;
  staffId: string;
  upstreamSessionToken?: string;
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
        blockingIssue
        canFill
        courseCategory
        courseContent
        courseId
        courseName
        dayOfWeek
        demonstrationHours
        expectedOccurrences {
          date
          dayOfWeek
          lessonHours
          periodEnd
          periodStart
          weekNumber
        }
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
        warnings
        weekNumber
      }
      journalCount
      missingCount
      missingItems {
        blockingIssue
        canFill
        courseCategory
        courseContent
        courseId
        courseName
        dayOfWeek
        demonstrationHours
        expectedOccurrences {
          date
          dayOfWeek
          lessonHours
          periodEnd
          periodStart
          weekNumber
        }
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
        warnings
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

const LIST_ACADEMIC_TEACHING_LOG_PREFILL_ITEMS_QUERY = `
  query ListAcademicTeachingLogPrefillItems(
    $departmentId: String
    $semesterId: Int!
    $staffId: String!
    $upstreamSessionToken: String
  ) {
    listAcademicTeachingLogPrefillItems(
      departmentId: $departmentId
      semesterId: $semesterId
      staffId: $staffId
      upstreamSessionToken: $upstreamSessionToken
    ) {
      blockingIssue
      canFill
      expiresAt
      integratedPreviews {
        blockingIssue
        canFill
        completeAndSummary
        courseName
        dayOfWeek
        disciplineSituation
        expectedOccurrences {
          date
          dayOfWeek
          lessonHours
          periodEnd
          periodStart
          weekNumber
        }
        learningSessionContent
        learningSessionNo
        learningSessionTarget
        learningTaskName
        learningTaskNo
        learningTaskText
        lecturePlanDetailId
        lecturePlanId
        lessonHours
        matchedLectureJournalDetailId
        problemAndSolve
        securityAndMaintain
        shift
        status
        teachingClassId
        teachingClassName
        teachingDate
        teachingUnitAchievement
        teachingUnitContent
        teachingUnitName
        teachingUnitNo
        teachingUnitTarget
        teachingUnitText
        warnings
        weekNumber
      }
      upstreamSessionToken
      warnings
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

function normalizeFetchAcademicTeachingLogPrefillInput(
  input: FetchAcademicTeachingLogPrefillInput,
) {
  const departmentId = normalizeOptionalString(input.departmentId);
  const staffId = String(input.staffId || '').trim();
  const upstreamSessionToken = normalizeOptionalString(input.upstreamSessionToken);

  if (!staffId) {
    throw new Error('staffId 为必填。');
  }

  return {
    departmentId,
    semesterId: input.semesterId,
    staffId,
    upstreamSessionToken,
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

export async function fetchAcademicTeachingLogPrefillItems(
  input: FetchAcademicTeachingLogPrefillInput,
) {
  try {
    const response = await requestGraphQL<
      AcademicTeachingLogPrefillResponse,
      FetchAcademicTeachingLogPrefillInput & {
        departmentId?: string;
        upstreamSessionToken?: string;
      }
    >(
      LIST_ACADEMIC_TEACHING_LOG_PREFILL_ITEMS_QUERY,
      normalizeFetchAcademicTeachingLogPrefillInput(input),
    );

    return response.listAcademicTeachingLogPrefillItems;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载教学日志预填项。'));
  }
}
