// src/features/academic-workload/infrastructure/academic-workload-api.ts
import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type { AcademicTeacherEngagementType } from '../application/teacher-engagement';

export type AcademicStableWorkloadCalcEffect =
  | 'CANCEL'
  | 'MAKEUP'
  | 'NORMAL'
  | 'SWAP_IN'
  | 'SWAP_OUT';

export type { AcademicTeacherEngagementType } from '../application/teacher-engagement';

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

export type AcademicWorkloadReportItem = {
  coefficient: string;
  courseName: string | null;
  hours: string;
  staffId: string;
  staffName: string;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  teacherEngagementType: AcademicTeacherEngagementType;
  teachingClassName: string;
  weekCount: number;
  weeklyHours: string;
};

export type AcademicWorkloadReportTotal = {
  hours: string;
  itemCount: number;
  staffCount: number;
};

export type AcademicWorkloadReportEnvelope = {
  invalidReason: string | null;
  isComplete: boolean;
  isValid: boolean;
  items: AcademicWorkloadReportItem[];
  total: AcademicWorkloadReportTotal;
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

export type RequestMyAcademicStableWorkloadInput = Omit<
  RequestAcademicStableWorkloadInput,
  'staffId'
>;

export type RequestAcademicWorkloadReportInput = {
  endDate?: string;
  semesterId: number;
  startDate?: string;
  teacherEngagementType?: AcademicTeacherEngagementType;
  workloadDepartmentId?: string;
};

export type AcademicWorkloadDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

type AcademicStableWorkloadResponse = {
  listAcademicStableWorkloadOccurrences: AcademicStableWorkloadEnvelope;
};

type MyAcademicStableWorkloadResponse = {
  listMyAcademicStableWorkloadOccurrences: AcademicStableWorkloadEnvelope;
};

type AcademicWorkloadReportResponse = {
  getAcademicWorkloadReport: AcademicWorkloadReportEnvelope;
};

type AcademicWorkloadDepartmentOptionsResponse = {
  departments: AcademicWorkloadDepartmentOption[];
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

const LIST_MY_ACADEMIC_STABLE_WORKLOAD_OCCURRENCES_QUERY = `
  query ListMyAcademicStableWorkloadOccurrences(
    $endDate: String
    $semesterId: Int!
    $startDate: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
  ) {
    listMyAcademicStableWorkloadOccurrences(
      endDate: $endDate
      semesterId: $semesterId
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

const GET_ACADEMIC_WORKLOAD_REPORT_QUERY = `
  query GetAcademicWorkloadReport(
    $semesterId: Int!
    $workloadDepartmentId: String
    $teacherEngagementType: AcademicTeacherEngagementType
    $startDate: String
    $endDate: String
  ) {
    getAcademicWorkloadReport(
      semesterId: $semesterId
      workloadDepartmentId: $workloadDepartmentId
      teacherEngagementType: $teacherEngagementType
      startDate: $startDate
      endDate: $endDate
    ) {
      isValid
      invalidReason
      isComplete
      truncationReason
      items {
        staffId
        staffName
        teacherEngagementType
        sstsTeachingClassId
        teachingClassName
        sstsCourseId
        courseName
        weeklyHours
        weekCount
        coefficient
        hours
      }
      total {
        itemCount
        staffCount
        hours
      }
    }
  }
`;

const ACADEMIC_WORKLOAD_DEPARTMENT_OPTIONS_QUERY = `
  query AcademicWorkloadDepartmentOptions($isEnabled: Boolean, $limit: Int) {
    departments(isEnabled: $isEnabled, limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
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

function normalizeMyRequestInput(input: RequestMyAcademicStableWorkloadInput) {
  return {
    endDate: normalizeStringFilter(input.endDate),
    semesterId: input.semesterId,
    startDate: normalizeStringFilter(input.startDate),
    sstsCourseId: normalizeStringFilter(input.sstsCourseId),
    sstsTeachingClassId: normalizeStringFilter(input.sstsTeachingClassId),
  };
}

function normalizeReportRequestInput(input: RequestAcademicWorkloadReportInput) {
  return {
    endDate: normalizeStringFilter(input.endDate),
    semesterId: input.semesterId,
    startDate: normalizeStringFilter(input.startDate),
    teacherEngagementType: input.teacherEngagementType,
    workloadDepartmentId: normalizeStringFilter(input.workloadDepartmentId),
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

export async function requestMyAcademicStableWorkloadOccurrences(
  input: RequestMyAcademicStableWorkloadInput,
) {
  try {
    const response = await executeGraphQL<
      MyAcademicStableWorkloadResponse,
      OperationVariables & RequestMyAcademicStableWorkloadInput
    >(LIST_MY_ACADEMIC_STABLE_WORKLOAD_OCCURRENCES_QUERY, normalizeMyRequestInput(input));

    return response.listMyAcademicStableWorkloadOccurrences;
  } catch (error) {
    throw new Error(resolveAcademicWorkloadErrorMessage(error, '暂时无法加载本人教师工作量。'));
  }
}

export async function requestAcademicWorkloadReport(input: RequestAcademicWorkloadReportInput) {
  try {
    const response = await executeGraphQL<
      AcademicWorkloadReportResponse,
      OperationVariables & RequestAcademicWorkloadReportInput
    >(GET_ACADEMIC_WORKLOAD_REPORT_QUERY, normalizeReportRequestInput(input));

    return response.getAcademicWorkloadReport;
  } catch (error) {
    throw new Error(resolveAcademicWorkloadErrorMessage(error, '暂时无法加载教师工作量预报。'));
  }
}

export async function requestAcademicWorkloadDepartmentOptions() {
  try {
    const response = await executeGraphQL<
      AcademicWorkloadDepartmentOptionsResponse,
      {
        isEnabled: boolean;
        limit: number;
      }
    >(ACADEMIC_WORKLOAD_DEPARTMENT_OPTIONS_QUERY, { isEnabled: true, limit: 500 });

    return response.departments;
  } catch (error) {
    throw new Error(resolveAcademicWorkloadErrorMessage(error, '暂时无法加载归口系列表。'));
  }
}
