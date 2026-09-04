// src/features/academic-workload/infrastructure/external-teacher-compensation-api.ts
import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type { AcademicTeacherEngagementType } from './academic-workload-api';

export type {
  AcademicTeacherEngagementType,
  AcademicWorkloadDepartmentOption,
} from './academic-workload-api';
export { requestAcademicWorkloadDepartmentOptions } from './academic-workload-api';

export type AcademicAdjustedWorkloadReportItem = {
  actualHours: string;
  addedHours: string;
  adjustmentHours: string;
  budgetHours: string;
  coefficient: string;
  courseCategory: string | null;
  courseName: string | null;
  deductedHours: string;
  rowKey: string;
  semesterId: number;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
  staffId: string;
  staffName: string;
  teacherEngagementType: AcademicTeacherEngagementType;
  teachingClassName: string;
  teachingClasses: Array<{
    sstsTeachingClassId: string | null;
    teachingClassName: string;
  }>;
  weekCount: number;
  weekIndexes: number[];
  weeklyHours: string;
  workloadDepartmentId: string;
  workloadDepartmentName: string;
};

export type AcademicAdjustedWorkloadReportTotal = {
  actualHours: string;
  addedHours: string;
  adjustmentHours: string;
  budgetHours: string;
  deductedHours: string;
  itemCount: number;
  staffCount: number;
};

export type AcademicAdjustedWorkloadReportEnvelope = {
  invalidReason: string | null;
  isComplete: boolean;
  isValid: boolean;
  items: AcademicAdjustedWorkloadReportItem[];
  total: AcademicAdjustedWorkloadReportTotal;
  truncationReason: string | null;
};

export type RequestAcademicAdjustedWorkloadReportInput = {
  endWeekIndex?: number;
  semesterId: number;
  startWeekIndex?: number;
  teacherEngagementType?: AcademicTeacherEngagementType;
  workloadDepartmentId?: string;
};

type AcademicAdjustedWorkloadReportResponse = {
  getAcademicAdjustedWorkloadReport: AcademicAdjustedWorkloadReportEnvelope;
};

const GET_ACADEMIC_ADJUSTED_WORKLOAD_REPORT_QUERY = `
  query GetAcademicAdjustedWorkloadReport(
    $semesterId: Int!
    $workloadDepartmentId: String
    $teacherEngagementType: AcademicTeacherEngagementType
    $startWeekIndex: Int
    $endWeekIndex: Int
  ) {
    getAcademicAdjustedWorkloadReport(
      semesterId: $semesterId
      workloadDepartmentId: $workloadDepartmentId
      teacherEngagementType: $teacherEngagementType
      startWeekIndex: $startWeekIndex
      endWeekIndex: $endWeekIndex
    ) {
      isValid
      invalidReason
      isComplete
      truncationReason
      items {
        rowKey
        semesterId
        workloadDepartmentId
        workloadDepartmentName
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
        courseCategory
        weeklyHours
        weekCount
        coefficient
        budgetHours
        deductedHours
        addedHours
        adjustmentHours
        actualHours
      }
      total {
        itemCount
        staffCount
        budgetHours
        deductedHours
        addedHours
        adjustmentHours
        actualHours
      }
    }
  }
`;

function normalizeStringFilter(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeRequestInput(input: RequestAcademicAdjustedWorkloadReportInput) {
  return {
    endWeekIndex: input.endWeekIndex,
    semesterId: input.semesterId,
    startWeekIndex: input.startWeekIndex,
    teacherEngagementType: input.teacherEngagementType,
    workloadDepartmentId: normalizeStringFilter(input.workloadDepartmentId),
  };
}

function resolveAcademicAdjustedWorkloadReportErrorMessage(error: unknown, fallback: string) {
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

export async function requestAcademicAdjustedWorkloadReport(
  input: RequestAcademicAdjustedWorkloadReportInput,
) {
  try {
    const response = await executeGraphQL<
      AcademicAdjustedWorkloadReportResponse,
      OperationVariables & RequestAcademicAdjustedWorkloadReportInput
    >(GET_ACADEMIC_ADJUSTED_WORKLOAD_REPORT_QUERY, normalizeRequestInput(input));

    return response.getAcademicAdjustedWorkloadReport;
  } catch (error) {
    throw new Error(
      resolveAcademicAdjustedWorkloadReportErrorMessage(error, '暂时无法加载外聘兼课金结算表。'),
    );
  }
}
