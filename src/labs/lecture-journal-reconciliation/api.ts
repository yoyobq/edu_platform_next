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

type SaveAcademicTheoryTeachingLogResponse = {
  saveAcademicTheoryTeachingLog: AcademicTeachingLogSaveResult;
};

type SaveAcademicPracticeTeachingLogResponse = {
  saveAcademicPracticeTeachingLog: AcademicTeachingLogSaveResult;
};

type SaveAcademicIntegratedTeachingLogResponse = {
  saveAcademicIntegratedTeachingLog: AcademicTeachingLogSaveResult;
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

export type LectureJournalReconciliationResult = {
  expiresAt: string;
  items: LectureJournalReconciliationItem[];
  journalCount: number;
  planCount: number;
  planDetailCount: number;
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
  endDate?: string;
  semesterId: number;
  staffId: string;
  startDate?: string;
  upstreamSessionToken?: string;
};

export type AcademicTeachingLogSaveResult = {
  code: number;
  expiresAt: string;
  lectureJournalDetailId: string | null;
  msg: string;
  success: boolean;
  upstreamSessionToken: string;
};

export type SaveAcademicTheoryTeachingLogInput = {
  courseContent: string;
  dayOfWeek: string;
  homeworkAssignment: string;
  lectureJournalDetailId?: string;
  lecturePlanDetailId?: string;
  lessonHours: number;
  minSectionId?: string;
  sectionId: string;
  teachingClassId: string;
  teachingDate: string;
  topicRecord: string;
  upstreamSessionToken: string;
  weekNumber: string;
};

export type SaveAcademicPracticeTeachingLogInput = {
  completeAndSummary?: string;
  courseContent: string;
  dayOfWeek: string;
  disciplineSituation?: string;
  exampleLessons?: number;
  homeworkAssignment: string;
  lectureJournalDetailId?: string;
  lectureLessons?: number;
  lecturePlanDetailId?: string;
  lessonHours: number;
  minSectionId?: string;
  problemAndSolve?: string;
  productionBackNum?: number;
  productionName?: string;
  productionPlanNum?: number;
  productionProjectTitle?: string;
  productionQualifiedNum?: number;
  productionWasteNum?: number;
  sectionId?: string;
  sectionName?: string;
  securityAndMaintain?: string;
  shift?: string;
  teachingClassId: string;
  teachingDate: string;
  topicRecord?: string;
  trainingLessons?: number;
  upstreamSessionToken: string;
  weekNumber: string;
};

export type SaveAcademicIntegratedTeachingLogInput = {
  completeAndSummary?: string;
  courseContent?: string;
  dayOfWeek: string;
  disciplineSituation?: string;
  homeworkAssignment?: string;
  lectureJournalDetailId?: string;
  lecturePlanDetailId: string;
  lessonHours: number;
  problemAndSolve?: string;
  securityAndMaintain?: string;
  shift?: string;
  teachingClassId: string;
  teachingDate: string;
  topicRecord?: string;
  upstreamSessionToken: string;
  weekNumber: string;
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
      planCount
      planDetailCount
      upstreamSessionToken
    }
  }
`;

const LIST_ACADEMIC_TEACHING_LOG_PREFILL_ITEMS_QUERY = `
  query ListAcademicTeachingLogPrefillItems(
    $departmentId: String
    $endDate: String
    $semesterId: Int!
    $staffId: String!
    $startDate: String
    $upstreamSessionToken: String
  ) {
    listAcademicTeachingLogPrefillItems(
      departmentId: $departmentId
      endDate: $endDate
      semesterId: $semesterId
      staffId: $staffId
      startDate: $startDate
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

const SAVE_ACADEMIC_THEORY_TEACHING_LOG_MUTATION = `
  mutation SaveAcademicTheoryTeachingLog($input: SaveAcademicTheoryTeachingLogInput!) {
    saveAcademicTheoryTeachingLog(input: $input) {
      code
      expiresAt
      lectureJournalDetailId
      msg
      success
      upstreamSessionToken
    }
  }
`;

const SAVE_ACADEMIC_PRACTICE_TEACHING_LOG_MUTATION = `
  mutation SaveAcademicPracticeTeachingLog($input: SaveAcademicPracticeTeachingLogInput!) {
    saveAcademicPracticeTeachingLog(input: $input) {
      code
      expiresAt
      lectureJournalDetailId
      msg
      success
      upstreamSessionToken
    }
  }
`;

const SAVE_ACADEMIC_INTEGRATED_TEACHING_LOG_MUTATION = `
  mutation SaveAcademicIntegratedTeachingLog($input: SaveAcademicIntegratedTeachingLogInput!) {
    saveAcademicIntegratedTeachingLog(input: $input) {
      code
      expiresAt
      lectureJournalDetailId
      msg
      success
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

function normalizeRequiredString(value: string, fieldName: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} 为必填。`);
  }

  return normalizedValue;
}

function normalizeOptionalNumber(value?: number) {
  return typeof value === 'number' ? value : undefined;
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
  const endDate = normalizeOptionalString(input.endDate);
  const staffId = String(input.staffId || '').trim();
  const startDate = normalizeOptionalString(input.startDate);
  const upstreamSessionToken = normalizeOptionalString(input.upstreamSessionToken);

  if (!staffId) {
    throw new Error('staffId 为必填。');
  }

  return {
    departmentId,
    endDate,
    semesterId: input.semesterId,
    staffId,
    startDate,
    upstreamSessionToken,
  };
}

function normalizeSaveAcademicTheoryTeachingLogInput(input: SaveAcademicTheoryTeachingLogInput) {
  return {
    courseContent: normalizeRequiredString(input.courseContent, 'courseContent'),
    dayOfWeek: normalizeRequiredString(input.dayOfWeek, 'dayOfWeek'),
    homeworkAssignment: normalizeRequiredString(input.homeworkAssignment, 'homeworkAssignment'),
    lectureJournalDetailId: normalizeOptionalString(input.lectureJournalDetailId),
    lecturePlanDetailId: normalizeOptionalString(input.lecturePlanDetailId),
    lessonHours: input.lessonHours,
    minSectionId: normalizeOptionalString(input.minSectionId),
    sectionId: normalizeRequiredString(input.sectionId, 'sectionId'),
    teachingClassId: normalizeRequiredString(input.teachingClassId, 'teachingClassId'),
    teachingDate: normalizeRequiredString(input.teachingDate, 'teachingDate'),
    topicRecord: normalizeRequiredString(input.topicRecord, 'topicRecord'),
    upstreamSessionToken: normalizeRequiredString(
      input.upstreamSessionToken,
      'upstreamSessionToken',
    ),
    weekNumber: normalizeRequiredString(input.weekNumber, 'weekNumber'),
  };
}

function normalizeSaveAcademicPracticeTeachingLogInput(
  input: SaveAcademicPracticeTeachingLogInput,
) {
  return {
    completeAndSummary: normalizeOptionalString(input.completeAndSummary),
    courseContent: normalizeRequiredString(input.courseContent, 'courseContent'),
    dayOfWeek: normalizeRequiredString(input.dayOfWeek, 'dayOfWeek'),
    disciplineSituation: normalizeOptionalString(input.disciplineSituation),
    exampleLessons: normalizeOptionalNumber(input.exampleLessons),
    homeworkAssignment: normalizeRequiredString(input.homeworkAssignment, 'homeworkAssignment'),
    lectureJournalDetailId: normalizeOptionalString(input.lectureJournalDetailId),
    lectureLessons: normalizeOptionalNumber(input.lectureLessons),
    lecturePlanDetailId: normalizeOptionalString(input.lecturePlanDetailId),
    lessonHours: input.lessonHours,
    minSectionId: normalizeOptionalString(input.minSectionId),
    problemAndSolve: normalizeOptionalString(input.problemAndSolve),
    productionBackNum: normalizeOptionalNumber(input.productionBackNum),
    productionName: normalizeOptionalString(input.productionName),
    productionPlanNum: normalizeOptionalNumber(input.productionPlanNum),
    productionProjectTitle: normalizeOptionalString(input.productionProjectTitle),
    productionQualifiedNum: normalizeOptionalNumber(input.productionQualifiedNum),
    productionWasteNum: normalizeOptionalNumber(input.productionWasteNum),
    securityAndMaintain: normalizeOptionalString(input.securityAndMaintain),
    shift: normalizeOptionalString(input.shift),
    teachingClassId: normalizeRequiredString(input.teachingClassId, 'teachingClassId'),
    teachingDate: normalizeRequiredString(input.teachingDate, 'teachingDate'),
    topicRecord: normalizeOptionalString(input.topicRecord),
    trainingLessons: normalizeOptionalNumber(input.trainingLessons),
    upstreamSessionToken: normalizeRequiredString(
      input.upstreamSessionToken,
      'upstreamSessionToken',
    ),
    weekNumber: normalizeRequiredString(input.weekNumber, 'weekNumber'),
  };
}

function normalizeSaveAcademicIntegratedTeachingLogInput(
  input: SaveAcademicIntegratedTeachingLogInput,
) {
  return {
    completeAndSummary: normalizeOptionalString(input.completeAndSummary),
    courseContent: normalizeOptionalString(input.courseContent),
    dayOfWeek: normalizeRequiredString(input.dayOfWeek, 'dayOfWeek'),
    disciplineSituation: normalizeOptionalString(input.disciplineSituation),
    homeworkAssignment: normalizeOptionalString(input.homeworkAssignment),
    lectureJournalDetailId: normalizeOptionalString(input.lectureJournalDetailId),
    lecturePlanDetailId: normalizeRequiredString(input.lecturePlanDetailId, 'lecturePlanDetailId'),
    lessonHours: input.lessonHours,
    problemAndSolve: normalizeOptionalString(input.problemAndSolve),
    securityAndMaintain: normalizeOptionalString(input.securityAndMaintain),
    shift: normalizeOptionalString(input.shift),
    teachingClassId: normalizeRequiredString(input.teachingClassId, 'teachingClassId'),
    teachingDate: normalizeRequiredString(input.teachingDate, 'teachingDate'),
    topicRecord: normalizeOptionalString(input.topicRecord),
    upstreamSessionToken: normalizeRequiredString(
      input.upstreamSessionToken,
      'upstreamSessionToken',
    ),
    weekNumber: normalizeRequiredString(input.weekNumber, 'weekNumber'),
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
        endDate?: string;
        startDate?: string;
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

export async function saveAcademicTheoryTeachingLog(input: SaveAcademicTheoryTeachingLogInput) {
  try {
    const response = await requestGraphQL<
      SaveAcademicTheoryTeachingLogResponse,
      {
        input: ReturnType<typeof normalizeSaveAcademicTheoryTeachingLogInput>;
      }
    >(SAVE_ACADEMIC_THEORY_TEACHING_LOG_MUTATION, {
      input: normalizeSaveAcademicTheoryTeachingLogInput(input),
    });

    return response.saveAcademicTheoryTeachingLog;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法保存理论课教学日志。'));
  }
}

export async function saveAcademicPracticeTeachingLog(input: SaveAcademicPracticeTeachingLogInput) {
  try {
    const response = await requestGraphQL<
      SaveAcademicPracticeTeachingLogResponse,
      {
        input: ReturnType<typeof normalizeSaveAcademicPracticeTeachingLogInput>;
      }
    >(SAVE_ACADEMIC_PRACTICE_TEACHING_LOG_MUTATION, {
      input: normalizeSaveAcademicPracticeTeachingLogInput(input),
    });

    return response.saveAcademicPracticeTeachingLog;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法保存实训课教学日志。'));
  }
}

export async function saveAcademicIntegratedTeachingLog(
  input: SaveAcademicIntegratedTeachingLogInput,
) {
  try {
    const response = await requestGraphQL<
      SaveAcademicIntegratedTeachingLogResponse,
      {
        input: ReturnType<typeof normalizeSaveAcademicIntegratedTeachingLogInput>;
      }
    >(SAVE_ACADEMIC_INTEGRATED_TEACHING_LOG_MUTATION, {
      input: normalizeSaveAcademicIntegratedTeachingLogInput(input),
    });

    return response.saveAcademicIntegratedTeachingLog;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法保存一体化教学日志。'));
  }
}
