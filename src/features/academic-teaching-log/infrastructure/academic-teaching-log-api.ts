import type { OperationVariables } from '@apollo/client';

import { isExpiredUpstreamSessionError } from '@/entities/upstream-session';

import { executeGraphQL } from '@/shared/graphql';

import { resolveLectureJournalUpstreamErrorMessage } from '../application/lecture-journal-issue-message';
import type {
  AcademicTeachingLogPrefillResult,
  AcademicTeachingLogSaveResult,
  FetchAcademicTeachingLogPrefillInput,
  FetchMyAcademicTeachingLogPrefillInput,
  SaveAcademicIntegratedTeachingLogInput,
  SaveAcademicPracticeTeachingLogInput,
  SaveAcademicTheoryTeachingLogInput,
} from '../application/types';

export type {
  AcademicIntegratedTeachingLogPrefillPreview,
  AcademicTeachingLogPrefillItem,
  AcademicTeachingLogPrefillResult,
  AcademicTeachingLogSaveResult,
  FetchAcademicTeachingLogPrefillInput,
  FetchMyAcademicTeachingLogPrefillInput,
  LectureJournalExpectedOccurrence,
  LectureJournalReconciliationItem,
  LectureJournalReconciliationResult,
  LectureJournalReconciliationStatus,
  MatchedLectureJournalSummary,
  SaveAcademicIntegratedTeachingLogInput,
  SaveAcademicPracticeTeachingLogInput,
  SaveAcademicTheoryTeachingLogInput,
  UnmatchedLectureJournalPlanItem,
} from '../application/types';

type AcademicTeachingLogPrefillResponse = {
  listAcademicTeachingLogPrefillItems: AcademicTeachingLogPrefillResult;
};

type MyAcademicTeachingLogPrefillResponse = {
  listMyAcademicTeachingLogPrefillItems: AcademicTeachingLogPrefillResult;
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

const ACADEMIC_TEACHING_LOG_PREFILL_RESULT_FIELDS = `
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
      items {
        calcEffect
        classroomName
        courseCategory
        courseName
        date
        isEffective
        periodEnd
        periodStart
        scheduleId
        semesterId
        slotId
        staffId
        teachingClassName
      }
      reconciliation {
        filledCount
        items {
          blockingIssue
          canFill
          completeAndSummary
          courseCategory
          courseContent
          courseId
          courseName
          dayOfWeek
          demonstrationHours
          disciplineSituation
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
            completeAndSummary
            courseContent
            disciplineSituation
            homeworkAssignment
            lectureJournalDetailId
            lectureJournalId
            problemAndSolve
            rawJournal
            securityAndMaintain
            shift
            statusCode
            statusName
            topicRecord
          }
          learningSessionContent
          learningSessionNo
          learningSessionTarget
          learningTaskName
          learningTaskNo
          learningTaskText
          lectureHours
          lecturePlanDetailId
          lecturePlanId
          lessonHours
          matchKey
          practiceHours
          problemAndSolve
          reason
          schoolYear
          sectionId
          sectionName
          securityAndMaintain
          semester
          shift
          status
          teacherId
          teacherName
          teachingChapterContent
          teachingClassId
          teachingClassName
          teachingDate
          teachingUnitAchievement
          teachingUnitContent
          teachingUnitName
          teachingUnitNo
          teachingUnitTarget
          teachingUnitText
          topicName
          warnings
          weekNumber
        }
        journalCount
        missingCount
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
      }
      upstreamSessionToken
      warnings
`;

const LIST_ACADEMIC_TEACHING_LOG_PREFILL_ITEMS_QUERY = `
  query ListAcademicTeachingLogPrefillItems(
    $endDate: String
    $semesterId: Int!
    $staffId: String!
    $startDate: String
    $upstreamSessionToken: String
  ) {
    listAcademicTeachingLogPrefillItems(
      endDate: $endDate
      semesterId: $semesterId
      staffId: $staffId
      startDate: $startDate
      upstreamSessionToken: $upstreamSessionToken
    ) {
${ACADEMIC_TEACHING_LOG_PREFILL_RESULT_FIELDS}
    }
  }
`;

const LIST_MY_ACADEMIC_TEACHING_LOG_PREFILL_ITEMS_QUERY = `
  query ListMyAcademicTeachingLogPrefillItems(
    $endDate: String
    $semesterId: Int!
    $startDate: String
    $upstreamSessionToken: String
  ) {
    listMyAcademicTeachingLogPrefillItems(
      endDate: $endDate
      semesterId: $semesterId
      startDate: $startDate
      upstreamSessionToken: $upstreamSessionToken
    ) {
${ACADEMIC_TEACHING_LOG_PREFILL_RESULT_FIELDS}
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

function normalizeFetchAcademicTeachingLogPrefillInput(
  input: FetchAcademicTeachingLogPrefillInput,
) {
  const endDate = normalizeOptionalString(input.endDate);
  const staffId = String(input.staffId || '').trim();
  const startDate = normalizeOptionalString(input.startDate);
  const upstreamSessionToken = normalizeOptionalString(input.upstreamSessionToken);

  if (!staffId) {
    throw new Error('staffId 为必填。');
  }

  return {
    endDate,
    semesterId: input.semesterId,
    staffId,
    startDate,
    upstreamSessionToken,
  };
}

function normalizeFetchMyAcademicTeachingLogPrefillInput(
  input: FetchMyAcademicTeachingLogPrefillInput,
) {
  return {
    endDate: normalizeOptionalString(input.endDate),
    semesterId: input.semesterId,
    startDate: normalizeOptionalString(input.startDate),
    upstreamSessionToken: normalizeOptionalString(input.upstreamSessionToken),
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

export async function fetchAcademicTeachingLogPrefillItems(
  input: FetchAcademicTeachingLogPrefillInput,
) {
  try {
    const response = await requestGraphQL<
      AcademicTeachingLogPrefillResponse,
      FetchAcademicTeachingLogPrefillInput & {
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

    throw new Error(
      resolveLectureJournalUpstreamErrorMessage(error, '暂时无法加载教学日志预填项。'),
    );
  }
}

export async function fetchMyAcademicTeachingLogPrefillItems(
  input: FetchMyAcademicTeachingLogPrefillInput,
) {
  try {
    const response = await requestGraphQL<
      MyAcademicTeachingLogPrefillResponse,
      FetchMyAcademicTeachingLogPrefillInput & {
        endDate?: string;
        startDate?: string;
        upstreamSessionToken?: string;
      }
    >(
      LIST_MY_ACADEMIC_TEACHING_LOG_PREFILL_ITEMS_QUERY,
      normalizeFetchMyAcademicTeachingLogPrefillInput(input),
    );

    return response.listMyAcademicTeachingLogPrefillItems;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(
      resolveLectureJournalUpstreamErrorMessage(error, '暂时无法加载本人教学日志预填项。'),
    );
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

    throw new Error(
      resolveLectureJournalUpstreamErrorMessage(error, '暂时无法保存理论课教学日志。'),
    );
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

    throw new Error(
      resolveLectureJournalUpstreamErrorMessage(error, '暂时无法保存实训课教学日志。'),
    );
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

    throw new Error(
      resolveLectureJournalUpstreamErrorMessage(error, '暂时无法保存一体化教学日志。'),
    );
  }
}
