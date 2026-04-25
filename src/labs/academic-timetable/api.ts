import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type AcademicTimetableCalcEffect = 'CANCEL' | 'MAKEUP' | 'NORMAL' | 'SWAP_IN' | 'SWAP_OUT';

export type AcademicTeacherSemesterScheduleWeekType = 'ALL' | 'EVEN' | 'ODD' | string;

type AcademicPlannedTimetableProjectionInvalidReasonCode = string;
type AcademicPlannedTimetableProjectionTruncationReasonCode = string;

type AcademicSemesterPlannedTimetableItemDTO = {
  calcEffect: string;
  classroomName: string | null;
  coefficient: string;
  courseCategory: string | null;
  courseName: string | null;
  date: string;
  isEffective: boolean;
  logicalDayOfWeek: number;
  periodEnd: number;
  periodStart: number;
  physicalDayOfWeek: number;
  scheduleId: number;
  semesterId: number;
  slotId: number;
  staffId: string;
  staffName: string;
  teachingClassName: string;
  weekIndex: number;
};

type AcademicWeeklyPlannedTimetableItemDTO = AcademicSemesterPlannedTimetableItemDTO;

type AcademicTeacherSemesterScheduleItemDTO = {
  classroomId: number | null;
  classroomName: string | null;
  coefficient: string;
  courseCategory: string | null;
  courseName: string | null;
  dayOfWeek: number;
  periodEnd: number;
  periodStart: number;
  scheduleId: number;
  semesterId: number;
  slotId: number;
  staffId: string;
  staffName: string;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  teachingClassName: string;
  weekRanges: string | null;
  weekPattern: string;
  weekType: AcademicTeacherSemesterScheduleWeekType;
};

type AcademicPlannedTimetableResultDTO<TItem> = {
  invalidReason: AcademicPlannedTimetableProjectionInvalidReasonCode | null;
  isComplete: boolean;
  isValid: boolean;
  items: TItem[];
  truncationReason: AcademicPlannedTimetableProjectionTruncationReasonCode | null;
};

type AcademicTeacherSemesterScheduleResultDTO = {
  items: AcademicTeacherSemesterScheduleItemDTO[];
};

export type AcademicTimetableGridItem = {
  dayOfWeek: number;
  periodEnd: number;
  periodStart: number;
};

export type AcademicTimetableItem = {
  calcEffect: AcademicTimetableCalcEffect;
  classroomId: string | null;
  classroomName: string | null;
  coefficient: number | null;
  courseCategory: string | null;
  courseName: string;
  date: string;
  dayOfWeek: number;
  isEffective: boolean;
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
  weekIndex: number;
};

export type AcademicTeacherSemesterScheduleItem = {
  classroomId: number | null;
  classroomName: string | null;
  coefficient: number | null;
  courseCategory: string | null;
  courseName: string;
  dayOfWeek: number;
  periodEnd: number;
  periodStart: number;
  scheduleId: number;
  semesterId: number;
  slotId: number;
  staffId: string;
  staffName: string;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  teachingClassName: string;
  weekRanges: string | null;
  weekPattern: string;
  weekType: AcademicTeacherSemesterScheduleWeekType;
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

export type AcademicTeacherSemesterScheduleQueryFilters = {
  semesterId: number;
  staffId: string;
};

type AcademicSemesterTimetableItemsResponse = {
  listAcademicSemesterPlannedTimetable: AcademicPlannedTimetableResultDTO<AcademicSemesterPlannedTimetableItemDTO>;
};

type AcademicWeeklyTimetableItemsResponse = {
  listAcademicWeeklyPlannedTimetable: AcademicPlannedTimetableResultDTO<AcademicWeeklyPlannedTimetableItemDTO>;
};

type AcademicTeacherSemesterScheduleItemsResponse = {
  listAcademicTeacherSemesterScheduleItems: AcademicTeacherSemesterScheduleResultDTO;
};

const ACADEMIC_TIMETABLE_ITEM_FIELDS = `
  calcEffect
  classroomName
  coefficient
  courseCategory
  courseName
  date
  isEffective
  logicalDayOfWeek
  periodStart
  periodEnd
  physicalDayOfWeek
  scheduleId
  semesterId
  slotId
  staffId
  staffName
  teachingClassName
  weekIndex
`;

const LIST_ACADEMIC_SEMESTER_TIMETABLE_ITEMS_QUERY = `
  query ListAcademicSemesterPlannedTimetable(
    $semesterId: Int!
    $staffId: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
  ) {
    listAcademicSemesterPlannedTimetable(
      semesterId: $semesterId
      staffId: $staffId
      sstsCourseId: $sstsCourseId
      sstsTeachingClassId: $sstsTeachingClassId
    ) {
      invalidReason
      isComplete
      isValid
      items {
        ${ACADEMIC_TIMETABLE_ITEM_FIELDS}
      }
      truncationReason
    }
  }
`;

const LIST_ACADEMIC_WEEKLY_TIMETABLE_ITEMS_QUERY = `
  query ListAcademicWeeklyPlannedTimetable(
    $semesterId: Int!
    $staffId: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
    $weekIndex: Int!
  ) {
    listAcademicWeeklyPlannedTimetable(
      semesterId: $semesterId
      staffId: $staffId
      sstsCourseId: $sstsCourseId
      sstsTeachingClassId: $sstsTeachingClassId
      weekIndex: $weekIndex
    ) {
      invalidReason
      isComplete
      isValid
      items {
        ${ACADEMIC_TIMETABLE_ITEM_FIELDS}
      }
      truncationReason
    }
  }
`;

const LIST_ACADEMIC_TEACHER_SEMESTER_SCHEDULE_ITEMS_QUERY = `
  query ListAcademicTeacherSemesterScheduleItems($semesterId: Int!, $staffId: String!) {
    listAcademicTeacherSemesterScheduleItems(semesterId: $semesterId, staffId: $staffId) {
      items {
        classroomId
        classroomName
        coefficient
        courseCategory
        courseName
        dayOfWeek
        periodEnd
        periodStart
        scheduleId
        semesterId
        slotId
        staffId
        staffName
        sstsCourseId
        sstsTeachingClassId
        teachingClassName
        weekRanges
        weekPattern
        weekType
      }
    }
  }
`;

function normalizeStringFilter(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeSharedFilters(input: AcademicTimetableQueryFilters) {
  return {
    semesterId: input.semesterId,
    staffId: normalizeStringFilter(input.staffId),
    sstsCourseId: normalizeStringFilter(input.sstsCourseId),
    sstsTeachingClassId: normalizeStringFilter(input.sstsTeachingClassId),
  };
}

function mapCoefficient(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function mapAcademicTimetableItem(
  item: AcademicSemesterPlannedTimetableItemDTO | AcademicWeeklyPlannedTimetableItemDTO,
): AcademicTimetableItem {
  return {
    calcEffect: item.calcEffect as AcademicTimetableCalcEffect,
    classroomId: null,
    classroomName: item.classroomName,
    coefficient: mapCoefficient(item.coefficient),
    courseCategory: item.courseCategory,
    courseName: item.courseName?.trim() || '未命名课程',
    date: item.date,
    dayOfWeek: item.physicalDayOfWeek,
    isEffective: item.isEffective,
    periodEnd: item.periodEnd,
    periodStart: item.periodStart,
    scheduleId: item.scheduleId,
    semesterId: item.semesterId,
    slotId: item.slotId,
    staffId: item.staffId,
    staffName: item.staffName,
    sstsCourseId: null,
    sstsTeachingClassId: null,
    teachingClassName: item.teachingClassName,
    weekIndex: item.weekIndex,
  };
}

function mapAcademicTeacherSemesterScheduleItem(
  item: AcademicTeacherSemesterScheduleItemDTO,
): AcademicTeacherSemesterScheduleItem {
  return {
    classroomId: item.classroomId,
    classroomName: item.classroomName,
    coefficient: mapCoefficient(item.coefficient),
    courseCategory: item.courseCategory,
    courseName: item.courseName?.trim() || '未命名课程',
    dayOfWeek: item.dayOfWeek,
    periodEnd: item.periodEnd,
    periodStart: item.periodStart,
    scheduleId: item.scheduleId,
    semesterId: item.semesterId,
    slotId: item.slotId,
    staffId: item.staffId,
    staffName: item.staffName,
    sstsCourseId: item.sstsCourseId,
    sstsTeachingClassId: item.sstsTeachingClassId,
    teachingClassName: item.teachingClassName,
    weekRanges: item.weekRanges,
    weekPattern: item.weekPattern,
    weekType: item.weekType,
  };
}

function resolvePlannedTimetableItems<TItem extends AcademicSemesterPlannedTimetableItemDTO>(
  result: AcademicPlannedTimetableResultDTO<TItem>,
) {
  if (!result.isValid && result.invalidReason) {
    throw new Error(`课表投影无效：${result.invalidReason}`);
  }

  return result.items.map(mapAcademicTimetableItem);
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

    return resolvePlannedTimetableItems(response.listAcademicSemesterPlannedTimetable);
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

    return resolvePlannedTimetableItems(response.listAcademicWeeklyPlannedTimetable);
  } catch (error) {
    throw new Error(resolveAcademicTimetableErrorMessage(error, '暂时无法加载单周课表。'));
  }
}

export async function requestAcademicTeacherSemesterScheduleItems(
  input: AcademicTeacherSemesterScheduleQueryFilters,
) {
  try {
    const response = await requestGraphQL<
      AcademicTeacherSemesterScheduleItemsResponse,
      AcademicTeacherSemesterScheduleQueryFilters
    >(LIST_ACADEMIC_TEACHER_SEMESTER_SCHEDULE_ITEMS_QUERY, {
      semesterId: input.semesterId,
      staffId: input.staffId.trim(),
    });

    return response.listAcademicTeacherSemesterScheduleItems.items.map(
      mapAcademicTeacherSemesterScheduleItem,
    );
  } catch (error) {
    throw new Error(resolveAcademicTimetableErrorMessage(error, '暂时无法加载学期课表。'));
  }
}
