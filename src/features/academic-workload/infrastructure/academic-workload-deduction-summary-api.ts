// src/features/academic-workload/infrastructure/academic-workload-deduction-summary-api.ts
import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type { AcademicTeacherEngagementType } from './academic-workload-api';

export type {
  AcademicTeacherEngagementType,
  AcademicWorkloadDepartmentOption,
} from './academic-workload-api';
export { requestAcademicWorkloadDepartmentOptions } from './academic-workload-api';

export type AcademicWorkloadDeductionReasonDateSummary = {
  date: string;
  deductedHours: string;
};

export type AcademicWorkloadDeductionReasonSummary = {
  dateSummaries: AcademicWorkloadDeductionReasonDateSummary[];
  deductedHours: string;
  sourceEventType: string | null;
};

export type AcademicWorkloadDeductionSummaryTotal = {
  addedHours: string;
  baselineHours: string;
  deductedHours: string;
  itemCount: number;
  staffCount: number;
};

export type AcademicWorkloadDeductionDepartmentSummary = AcademicWorkloadDeductionSummaryTotal & {
  workloadDepartmentId: string;
  workloadDepartmentName: string;
};

export type AcademicWorkloadDeductionSummaryItem = {
  addedHours: string;
  adjustmentDates: string[];
  baselineHours: string;
  baselineTeachingWeekCount: number;
  baselineWeeklyHours: string;
  courseCategory: string | null;
  courseName: string | null;
  deductedHours: string;
  deductionReasonSummaries: AcademicWorkloadDeductionReasonSummary[];
  staffId: string;
  staffName: string;
  teacherEngagementType: AcademicTeacherEngagementType;
  teachingClassName: string;
  workloadDepartmentId: string;
  workloadDepartmentName: string;
};

export type AcademicWorkloadDeductionSummaryEnvelope = {
  departmentSummaries: AcademicWorkloadDeductionDepartmentSummary[];
  invalidReason: string | null;
  isComplete: boolean;
  isValid: boolean;
  items: AcademicWorkloadDeductionSummaryItem[];
  total: AcademicWorkloadDeductionSummaryTotal;
  truncationReason: string | null;
};

export type RequestAcademicWorkloadDeductionSummaryInput = {
  endDate?: string;
  semesterId: number;
  startDate?: string;
  teacherEngagementType?: AcademicTeacherEngagementType;
  workloadDepartmentId?: string;
};

type AcademicWorkloadDeductionSummaryResponse = {
  getAcademicWorkloadDeductionSummary: AcademicWorkloadDeductionSummaryEnvelope;
};

const GET_ACADEMIC_WORKLOAD_DEDUCTION_SUMMARY_QUERY = `
  query AcademicWorkloadDeductionSummary(
    $semesterId: Int!
    $workloadDepartmentId: String
    $teacherEngagementType: AcademicTeacherEngagementType
    $startDate: String
    $endDate: String
  ) {
    getAcademicWorkloadDeductionSummary(
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
      total {
        itemCount
        staffCount
        baselineHours
        deductedHours
        addedHours
      }
      departmentSummaries {
        workloadDepartmentId
        workloadDepartmentName
        itemCount
        staffCount
        baselineHours
        deductedHours
        addedHours
      }
      items {
        workloadDepartmentId
        workloadDepartmentName
        staffId
        staffName
        teacherEngagementType
        teachingClassName
        courseName
        courseCategory
        baselineTeachingWeekCount
        baselineWeeklyHours
        baselineHours
        deductedHours
        addedHours
        adjustmentDates
        deductionReasonSummaries {
          sourceEventType
          deductedHours
          dateSummaries {
            date
            deductedHours
          }
        }
      }
    }
  }
`;

function normalizeStringFilter(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeRequestInput(input: RequestAcademicWorkloadDeductionSummaryInput) {
  return {
    endDate: normalizeStringFilter(input.endDate),
    semesterId: input.semesterId,
    startDate: normalizeStringFilter(input.startDate),
    teacherEngagementType: input.teacherEngagementType,
    workloadDepartmentId: normalizeStringFilter(input.workloadDepartmentId),
  };
}

function resolveAcademicWorkloadDeductionSummaryErrorMessage(
  error: unknown,
  fallback = '暂时无法加载教师扣课汇总。',
) {
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

export async function requestAcademicWorkloadDeductionSummary(
  input: RequestAcademicWorkloadDeductionSummaryInput,
) {
  try {
    const response = await executeGraphQL<
      AcademicWorkloadDeductionSummaryResponse,
      OperationVariables & RequestAcademicWorkloadDeductionSummaryInput
    >(GET_ACADEMIC_WORKLOAD_DEDUCTION_SUMMARY_QUERY, normalizeRequestInput(input));

    return response.getAcademicWorkloadDeductionSummary;
  } catch (error) {
    throw new Error(
      resolveAcademicWorkloadDeductionSummaryErrorMessage(error, '暂时无法加载教师扣课汇总。'),
    );
  }
}
