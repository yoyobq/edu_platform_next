// src/features/academic-teaching-plan/infrastructure/api.ts

import type { OperationVariables } from '@apollo/client';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';
import { executeUpstreamSessionGraphQL } from '@/entities/upstream-session';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type {
  CurriculumPlanDetailReferenceCandidatesResult,
  TeachingPlanOccurrenceEnvelope,
  TeachingPlanTeacherOption,
} from '../types';

type AcademicSemestersResponse = {
  academicSemesters: AcademicSemesterRecord[];
};

type MyTeachingPlanResponse = {
  listMyAcademicSemesterPlannedTimetable: TeachingPlanOccurrenceEnvelope;
};

type ManagedTeachingPlanResponse = {
  listManagedAcademicSemesterPlannedTimetable: TeachingPlanOccurrenceEnvelope;
};

type ManagedTeachingPlanTeacherOptionsResponse = {
  listManagedAcademicSemesterPlannedTimetableTeacherOptions: {
    items: TeachingPlanTeacherOption[];
  };
};

type UpdateCourseScheduleClassroomNameResponse = {
  updateAcademicCourseScheduleClassroomName: {
    classroomName: string;
    scheduleId: number;
  };
};

type ManagedCurriculumPlanDetailReferenceCandidatesResponse = {
  listAcademicCurriculumPlanDetailReferenceCandidates: CurriculumPlanDetailReferenceCandidatesResult;
};

type MyCurriculumPlanDetailReferenceCandidatesResponse = {
  listMyAcademicCurriculumPlanDetailReferenceCandidates: CurriculumPlanDetailReferenceCandidatesResult;
};

const TEACHING_PLAN_OCCURRENCE_FIELDS = `
  calcEffect
  classroomName
  coefficient
  courseCategory
  courseName
  date
  isEffective
  logicalDayOfWeek
  periodEnd
  periodStart
  physicalDayOfWeek
  scheduleId
  semesterId
  slotId
  staffId
  staffName
  teachingClassName
  weekIndex
`;

const ACADEMIC_SEMESTERS_QUERY = `
  query MyTeachingPlanAcademicSemesters($isVisible: Boolean, $limit: Int) {
    academicSemesters(isVisible: $isVisible, limit: $limit) {
      createdAt
      endDate
      examStartDate
      firstTeachingDate
      id
      isCurrent
      isVisible
      name
      schoolYear
      sortOrder
      startDate
      termNumber
      updatedAt
    }
  }
`;

const MY_TEACHING_PLAN_QUERY = `
  query MyTeachingPlan($semesterId: Int!) {
    listMyAcademicSemesterPlannedTimetable(semesterId: $semesterId) {
      invalidReason
      isComplete
      isValid
      items {
        ${TEACHING_PLAN_OCCURRENCE_FIELDS}
      }
      truncationReason
    }
  }
`;

const MANAGED_TEACHING_PLAN_QUERY = `
  query ManagedTeachingPlan($semesterId: Int!, $staffId: String!) {
    listManagedAcademicSemesterPlannedTimetable(
      semesterId: $semesterId
      staffId: $staffId
    ) {
      invalidReason
      isComplete
      isValid
      items {
        ${TEACHING_PLAN_OCCURRENCE_FIELDS}
      }
      truncationReason
    }
  }
`;

const MANAGED_TEACHING_PLAN_TEACHER_OPTIONS_QUERY = `
  query ManagedTeachingPlanTeacherOptions(
    $semesterId: Int!
    $keyword: String
    $limit: Int
  ) {
    listManagedAcademicSemesterPlannedTimetableTeacherOptions(
      semesterId: $semesterId
      keyword: $keyword
      limit: $limit
    ) {
      items {
        staffId
        staffName
      }
    }
  }
`;

const UPDATE_COURSE_SCHEDULE_CLASSROOM_NAME_MUTATION = `
  mutation UpdateAcademicCourseScheduleClassroomName(
    $input: UpdateAcademicCourseScheduleClassroomNameInput!
  ) {
    updateAcademicCourseScheduleClassroomName(input: $input) {
      classroomName
      scheduleId
    }
  }
`;

const CURRICULUM_PLAN_DETAIL_REFERENCE_FIELDS = `
  expiresAt
  items {
    courseName
    items {
      chapterAndContent
      dayOfWeek
      homework
      lessonHours
      sectionId
      sectionName
      sourceDetailId
      weekNumber
    }
    matchKind
    plannedLessons
    plannedLessonsDiff
    rank
    recommended
    schoolYear
    semester
    sourcePlanId
    teachingClassName
    weekCount
    weeklyHours
  }
  upstreamSessionToken
  warnings
`;

const MANAGED_CURRICULUM_PLAN_DETAIL_REFERENCE_CANDIDATES_QUERY = `
  query AcademicCurriculumPlanDetailReferenceCandidates(
    $context: CurriculumPlanDetailReferenceCandidatesContextInput!
    $upstreamSessionToken: String!
  ) {
    listAcademicCurriculumPlanDetailReferenceCandidates(
      context: $context
      upstreamSessionToken: $upstreamSessionToken
    ) {
      ${CURRICULUM_PLAN_DETAIL_REFERENCE_FIELDS}
    }
  }
`;

const MY_CURRICULUM_PLAN_DETAIL_REFERENCE_CANDIDATES_QUERY = `
  query MyAcademicCurriculumPlanDetailReferenceCandidates(
    $context: MyCurriculumPlanDetailReferenceCandidatesContextInput!
    $upstreamSessionToken: String!
  ) {
    listMyAcademicCurriculumPlanDetailReferenceCandidates(
      context: $context
      upstreamSessionToken: $upstreamSessionToken
    ) {
      ${CURRICULUM_PLAN_DETAIL_REFERENCE_FIELDS}
    }
  }
`;

export async function requestMyTeachingPlanAcademicSemesters() {
  return requestWithMessage(
    ACADEMIC_SEMESTERS_QUERY,
    { isVisible: true, limit: 500 },
    (response: AcademicSemestersResponse) => response.academicSemesters,
    '暂时无法加载学期列表。',
  );
}

export async function requestMyTeachingPlan(semesterId: number) {
  return requestWithMessage(
    MY_TEACHING_PLAN_QUERY,
    { semesterId },
    (response: MyTeachingPlanResponse) => response.listMyAcademicSemesterPlannedTimetable,
    '暂时无法加载本人授课计划。',
  );
}

export async function requestManagedTeachingPlan(input: { semesterId: number; staffId: string }) {
  return requestWithMessage(
    MANAGED_TEACHING_PLAN_QUERY,
    input,
    (response: ManagedTeachingPlanResponse) => response.listManagedAcademicSemesterPlannedTimetable,
    '暂时无法加载该教师的授课计划。',
  );
}

export async function requestManagedTeachingPlanTeacherOptions(input: {
  keyword?: string;
  limit?: number;
  semesterId: number;
}) {
  const variables = {
    semesterId: input.semesterId,
    keyword: normalizeOptionalText(input.keyword),
    limit: input.limit ?? 20,
  };

  return requestWithMessage(
    MANAGED_TEACHING_PLAN_TEACHER_OPTIONS_QUERY,
    variables,
    (response: ManagedTeachingPlanTeacherOptionsResponse) =>
      response.listManagedAcademicSemesterPlannedTimetableTeacherOptions.items,
    '暂时无法加载可查看的教师。',
  );
}

export async function requestUpdateAcademicCourseScheduleClassroomName(input: {
  classroomName: string;
  scheduleId: number;
}) {
  return requestWithMessage(
    UPDATE_COURSE_SCHEDULE_CLASSROOM_NAME_MUTATION,
    { input },
    (response: UpdateCourseScheduleClassroomNameResponse) =>
      response.updateAcademicCourseScheduleClassroomName,
    '暂时无法保存统一授课地点。',
  );
}

export async function requestCurriculumPlanDetailReferenceCandidates(input: {
  courseName: string;
  mode: 'managed' | 'self';
  plannedLessons: number;
  schoolYear: string;
  semester: string;
  staffId: string;
  upstreamSessionToken: string;
}) {
  const commonContext = {
    courseName: input.courseName.trim(),
    plannedLessons: input.plannedLessons,
    schoolYear: input.schoolYear.trim(),
    semester: input.semester.trim(),
  };

  if (input.mode === 'managed') {
    const response = await executeUpstreamSessionGraphQL<
      ManagedCurriculumPlanDetailReferenceCandidatesResponse,
      {
        context: typeof commonContext & { staffId: string };
        upstreamSessionToken: string;
      }
    >(MANAGED_CURRICULUM_PLAN_DETAIL_REFERENCE_CANDIDATES_QUERY, {
      context: { ...commonContext, staffId: input.staffId.trim() },
      upstreamSessionToken: input.upstreamSessionToken,
    });
    return response.listAcademicCurriculumPlanDetailReferenceCandidates;
  }

  const response = await executeUpstreamSessionGraphQL<
    MyCurriculumPlanDetailReferenceCandidatesResponse,
    {
      context: typeof commonContext;
      upstreamSessionToken: string;
    }
  >(MY_CURRICULUM_PLAN_DETAIL_REFERENCE_CANDIDATES_QUERY, {
    context: commonContext,
    upstreamSessionToken: input.upstreamSessionToken,
  });
  return response.listMyAcademicCurriculumPlanDetailReferenceCandidates;
}

async function requestWithMessage<TData, TVariables extends OperationVariables, TResult>(
  query: string,
  variables: TVariables,
  select: (response: TData) => TResult,
  fallback: string,
) {
  try {
    return select(await executeGraphQL<TData, TVariables>(query, variables));
  } catch (error) {
    throw new Error(resolveTeachingPlanErrorMessage(error, fallback));
  }
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || undefined;
}

function resolveTeachingPlanErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}
