import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type AcademicTimetableWeekType = 'ALL' | 'EVEN' | 'ODD';

export type AcademicTimetableItem = {
  classroomId: string | null;
  classroomName: string | null;
  coefficient: number | null;
  courseCategory: string | null;
  courseName: string;
  dayOfWeek: number;
  periodEnd: number;
  periodStart: number;
  scheduleId: number | string;
  semesterId: number;
  slotId: number | string;
  staffId: string | null;
  staffName: string | null;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  teachingClassName: string;
  weekPattern: string | null;
  weekType: AcademicTimetableWeekType;
};

export type AcademicTimetableQueryFilters = {
  limit?: number;
  semesterId: number;
  staffId?: string;
  sstsCourseId?: string;
  sstsTeachingClassId?: string;
};

export type AcademicWeeklyTimetableQueryFilters = AcademicTimetableQueryFilters & {
  weekIndex: number;
};

type AcademicSemesterTimetableItemsResponse = {
  listAcademicSemesterTimetableItems: AcademicTimetableItem[];
};

type AcademicWeeklyTimetableItemsResponse = {
  listAcademicWeeklyTimetableItems: AcademicTimetableItem[];
};

const ACADEMIC_TIMETABLE_ITEM_FIELDS = `
  scheduleId
  slotId
  staffId
  staffName
  semesterId
  courseName
  teachingClassName
  classroomId
  classroomName
  courseCategory
  coefficient
  sstsCourseId
  sstsTeachingClassId
  dayOfWeek
  periodStart
  periodEnd
  weekPattern
  weekType
`;

const LIST_ACADEMIC_SEMESTER_TIMETABLE_ITEMS_QUERY = `
  query ListAcademicSemesterTimetableItems(
    $limit: Int
    $semesterId: Int!
    $staffId: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
  ) {
    listAcademicSemesterTimetableItems(
      limit: $limit
      semesterId: $semesterId
      staffId: $staffId
      sstsCourseId: $sstsCourseId
      sstsTeachingClassId: $sstsTeachingClassId
    ) {
      ${ACADEMIC_TIMETABLE_ITEM_FIELDS}
    }
  }
`;

const LIST_ACADEMIC_WEEKLY_TIMETABLE_ITEMS_QUERY = `
  query ListAcademicWeeklyTimetableItems(
    $limit: Int
    $semesterId: Int!
    $staffId: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
    $weekIndex: Int!
  ) {
    listAcademicWeeklyTimetableItems(
      limit: $limit
      semesterId: $semesterId
      staffId: $staffId
      sstsCourseId: $sstsCourseId
      sstsTeachingClassId: $sstsTeachingClassId
      weekIndex: $weekIndex
    ) {
      ${ACADEMIC_TIMETABLE_ITEM_FIELDS}
    }
  }
`;

function normalizeStringFilter(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeSharedFilters(input: AcademicTimetableQueryFilters) {
  return {
    limit: input.limit ?? 100,
    semesterId: input.semesterId,
    staffId: normalizeStringFilter(input.staffId),
    sstsCourseId: normalizeStringFilter(input.sstsCourseId),
    sstsTeachingClassId: normalizeStringFilter(input.sstsTeachingClassId),
  };
}

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
) {
  return executeGraphQL<TData, TVariables>(query, variables);
}

export function resolveAcademicTimetableErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string') {
      return extensions.errorMessage;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function requestAcademicSemesterTimetableItems(input: AcademicTimetableQueryFilters) {
  try {
    const response = await requestGraphQL<
      AcademicSemesterTimetableItemsResponse,
      AcademicTimetableQueryFilters
    >(LIST_ACADEMIC_SEMESTER_TIMETABLE_ITEMS_QUERY, normalizeSharedFilters(input));

    return response.listAcademicSemesterTimetableItems;
  } catch (error) {
    throw new Error(resolveAcademicTimetableErrorMessage(error, '暂时无法加载学期课表。'));
  }
}

export async function requestAcademicWeeklyTimetableItems(
  input: AcademicWeeklyTimetableQueryFilters,
) {
  try {
    const response = await requestGraphQL<
      AcademicWeeklyTimetableItemsResponse,
      AcademicWeeklyTimetableQueryFilters
    >(LIST_ACADEMIC_WEEKLY_TIMETABLE_ITEMS_QUERY, {
      ...normalizeSharedFilters(input),
      weekIndex: input.weekIndex,
    });

    return response.listAcademicWeeklyTimetableItems;
  } catch (error) {
    throw new Error(resolveAcademicTimetableErrorMessage(error, '暂时无法加载单周课表。'));
  }
}
