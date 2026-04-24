import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type AcademicStableWorkloadCalcEffect =
  | 'CANCEL'
  | 'MAKEUP'
  | 'NORMAL'
  | 'SWAP_IN'
  | 'SWAP_OUT';

export type AcademicStableWorkloadOccurrence = {
  calcEffect: AcademicStableWorkloadCalcEffect;
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
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  teachingClassName: string;
  weekIndex: number;
};

export type AcademicStableWorkloadEnvelope = {
  invalidReason: string | null;
  isComplete: boolean;
  isValid: boolean;
  items: AcademicStableWorkloadOccurrence[];
  truncationReason: string | null;
};

export type RequestAcademicStableWorkloadInput = {
  endDate?: string;
  semesterId: number;
  staffId: string;
  startDate?: string;
  sstsCourseId?: string;
  sstsTeachingClassId?: string;
};

type AcademicStableWorkloadResponse = {
  listAcademicStableWorkloadOccurrences: AcademicStableWorkloadEnvelope;
};

const LIST_ACADEMIC_STABLE_WORKLOAD_OCCURRENCES_QUERY = `
  query ListAcademicStableWorkloadOccurrences(
    $endDate: String
    $semesterId: Int!
    $staffId: String!
    $startDate: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
  ) {
    listAcademicStableWorkloadOccurrences(
      endDate: $endDate
      semesterId: $semesterId
      staffId: $staffId
      startDate: $startDate
      sstsCourseId: $sstsCourseId
      sstsTeachingClassId: $sstsTeachingClassId
    ) {
      invalidReason
      isComplete
      isValid
      truncationReason
      items {
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
        sstsCourseId
        sstsTeachingClassId
        teachingClassName
        weekIndex
      }
    }
  }
`;

function normalizeStringFilter(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeRequestInput(input: RequestAcademicStableWorkloadInput) {
  return {
    endDate: normalizeStringFilter(input.endDate),
    semesterId: input.semesterId,
    staffId: input.staffId.trim(),
    startDate: normalizeStringFilter(input.startDate),
    sstsCourseId: normalizeStringFilter(input.sstsCourseId),
    sstsTeachingClassId: normalizeStringFilter(input.sstsTeachingClassId),
  };
}

function resolveAcademicWorkloadErrorMessage(error: unknown, fallback: string) {
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

export async function requestAcademicStableWorkloadOccurrences(
  input: RequestAcademicStableWorkloadInput,
) {
  try {
    const response = await executeGraphQL<
      AcademicStableWorkloadResponse,
      OperationVariables & RequestAcademicStableWorkloadInput
    >(LIST_ACADEMIC_STABLE_WORKLOAD_OCCURRENCES_QUERY, normalizeRequestInput(input));

    return response.listAcademicStableWorkloadOccurrences;
  } catch (error) {
    throw new Error(resolveAcademicWorkloadErrorMessage(error, '暂时无法加载教师工作量。'));
  }
}
