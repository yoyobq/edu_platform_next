// src/features/academic-workload/infrastructure/academic-workload-api.ts
import type { OperationVariables } from '@apollo/client';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type { AcademicTeacherEngagementType } from '../application/teacher-engagement';

export type AcademicStableWorkloadCalcEffect =
  | 'CANCEL'
  | 'MAKEUP'
  | 'NORMAL'
  | 'REPEAT'
  | 'SWAP_IN'
  | 'SWAP_OUT';

export type { AcademicTeacherEngagementType } from '../application/teacher-engagement';

export type ListAcademicSemestersInput = {
  isCurrent?: boolean;
  isVisible?: boolean;
  limit?: number;
  schoolYear?: number;
  termNumber?: number;
};

type AcademicSemesterDTO = AcademicSemesterRecord;

type AcademicSemestersResponse = {
  academicSemesters: AcademicSemesterDTO[];
};

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
  scheduleId: number | string;
  semesterId: number;
  slotId: number | string;
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
  rowKey: string;
  staffId: string;
  staffName: string;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  teacherEngagementType: AcademicTeacherEngagementType;
  teachingClassName: string;
  teachingClasses: AcademicTeachingDeliveryClass[];
  weekCount: number;
  weekIndexes: number[];
  weeklyHours: string;
};

export type AcademicTeachingDeliveryClass = {
  sstsTeachingClassId: string | null;
  teachingClassName: string;
};

type AcademicTeachingDeliveryDTO = {
  calcEffect: AcademicStableWorkloadCalcEffect;
  classroomName: string | null;
  coefficient: string;
  courseCategory: string | null;
  courseName: string | null;
  date: string;
  deliveryKey: string;
  isEffective: boolean;
  logicalDayOfWeek: number;
  periodEnd: number;
  periodStart: number;
  physicalDayOfWeek: number;
  semesterId: number;
  staffId: string;
  staffName: string;
  sstsCourseId: string | null;
  teachingClassName: string;
  teachingClasses: AcademicTeachingDeliveryClass[];
  weekIndex: number;
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
  listAcademicStableWorkloadTeachingDeliveries: Omit<AcademicStableWorkloadEnvelope, 'items'> & {
    items: AcademicTeachingDeliveryDTO[];
  };
};

type MyAcademicStableWorkloadResponse = {
  listMyAcademicStableWorkloadTeachingDeliveries: Omit<AcademicStableWorkloadEnvelope, 'items'> & {
    items: AcademicTeachingDeliveryDTO[];
  };
};

type AcademicWorkloadReportResponse = {
  getAcademicWorkloadReport: AcademicWorkloadReportEnvelope;
};

type AcademicWorkloadDepartmentOptionsResponse = {
  departments: AcademicWorkloadDepartmentOption[];
};

const LIST_ACADEMIC_STABLE_WORKLOAD_OCCURRENCES_QUERY = `
  query ListAcademicStableWorkloadTeachingDeliveries(
    $endDate: String
    $semesterId: Int!
    $staffId: String!
    $startDate: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
  ) {
    listAcademicStableWorkloadTeachingDeliveries(
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
        deliveryKey
        semesterId
        staffId
        staffName
        sstsCourseId
        teachingClassName
        teachingClasses {
          sstsTeachingClassId
          teachingClassName
        }
        weekIndex
      }
    }
  }
`;

const LIST_MY_ACADEMIC_STABLE_WORKLOAD_OCCURRENCES_QUERY = `
  query ListMyAcademicStableWorkloadTeachingDeliveries(
    $endDate: String
    $semesterId: Int!
    $startDate: String
    $sstsCourseId: String
    $sstsTeachingClassId: String
  ) {
    listMyAcademicStableWorkloadTeachingDeliveries(
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
        deliveryKey
        semesterId
        staffId
        staffName
        sstsCourseId
        teachingClassName
        teachingClasses {
          sstsTeachingClassId
          teachingClassName
        }
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
        rowKey
        staffId
        staffName
        teacherEngagementType
        sstsTeachingClassId
        teachingClassName
        teachingClasses {
          sstsTeachingClassId
          teachingClassName
        }
        weekIndexes
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

const LIST_ACADEMIC_SEMESTERS_QUERY = `
  query AcademicSemesters(
    $isCurrent: Boolean
    $isVisible: Boolean
    $limit: Int
    $schoolYear: Int
    $termNumber: Int
  ) {
    academicSemesters(
      isCurrent: $isCurrent
      isVisible: $isVisible
      limit: $limit
      schoolYear: $schoolYear
      termNumber: $termNumber
    ) {
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

function mapAcademicTeachingDelivery(
  item: AcademicTeachingDeliveryDTO,
): AcademicStableWorkloadOccurrence {
  return {
    ...item,
    scheduleId: item.deliveryKey,
    slotId: item.deliveryKey,
    sstsTeachingClassId:
      item.teachingClasses.length === 1
        ? (item.teachingClasses[0]?.sstsTeachingClassId ?? null)
        : null,
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

    return {
      ...response.listAcademicStableWorkloadTeachingDeliveries,
      items: response.listAcademicStableWorkloadTeachingDeliveries.items.map(
        mapAcademicTeachingDelivery,
      ),
    };
  } catch (error) {
    throw new Error(resolveAcademicWorkloadErrorMessage(error, '暂时无法加载教师工作量。'));
  }
}

export async function requestAcademicSemesters(input: ListAcademicSemestersInput = {}) {
  try {
    const response = await executeGraphQL<
      AcademicSemestersResponse,
      OperationVariables & ListAcademicSemestersInput
    >(LIST_ACADEMIC_SEMESTERS_QUERY, input);

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveAcademicWorkloadErrorMessage(error, '暂时无法加载学期列表。'));
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

    return {
      ...response.listMyAcademicStableWorkloadTeachingDeliveries,
      items: response.listMyAcademicStableWorkloadTeachingDeliveries.items.map(
        mapAcademicTeachingDelivery,
      ),
    };
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
