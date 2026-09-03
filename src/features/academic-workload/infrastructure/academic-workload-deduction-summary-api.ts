// src/features/academic-workload/infrastructure/academic-workload-deduction-summary-api.ts
import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type { AcademicTeacherEngagementType } from './academic-workload-api';

export type {
  AcademicTeacherEngagementType,
  AcademicWorkloadDepartmentOption,
} from './academic-workload-api';
export { requestAcademicWorkloadDepartmentOptions } from './academic-workload-api';

export type AcademicWorkloadDeductionDateColumn = {
  date: string;
  isRepeatedTeachingDate: boolean;
};

export type AcademicWorkloadDeductionDateAdjustment = {
  date: string;
  deductionSourceEventTypes: Array<string | null>;
  netAdjustmentHours: string;
  repeatedHours: string;
  residualDeductedHours: string;
};

export type AcademicWorkloadDeductionSummaryTotal = {
  addedHours: string;
  baselineHours: string;
  deductedHours: string;
  itemCount: number;
  netAdjustmentHours: string;
  repeatedHours: string;
  residualDeductedHours: string;
  staffCount: number;
};

export type AcademicWorkloadDeductionDepartmentSummary = AcademicWorkloadDeductionSummaryTotal & {
  workloadDepartmentId: string;
  workloadDepartmentName: string;
};

export type AcademicWorkloadDeductionSummaryItem = {
  baselineHours: string;
  baselineTeachingWeekCount: number;
  baselineWeeklyHours: string;
  courseCategory: string | null;
  courseName: string | null;
  dateAdjustments: AcademicWorkloadDeductionDateAdjustment[];
  netAdjustmentHours: string;
  repeatedHours: string;
  residualDeductedHours: string;
  staffId: string;
  staffName: string;
  teacherEngagementType: AcademicTeacherEngagementType;
  teachingClassName: string;
  workloadDepartmentId: string;
  workloadDepartmentName: string;
};

export type AcademicWorkloadDeductionStaffSummary = {
  itemCount: number;
  netAdjustmentHours: string;
  repeatedHours: string;
  residualDeductedHours: string;
  staffId: string;
  workloadDepartmentId: string;
};

export type AcademicWorkloadDeductionSummaryEnvelope = {
  dateColumns: AcademicWorkloadDeductionDateColumn[];
  departmentSummaries: AcademicWorkloadDeductionDepartmentSummary[];
  invalidReason: string | null;
  isComplete: boolean;
  isValid: boolean;
  items: AcademicWorkloadDeductionSummaryItem[];
  staffSummaries: AcademicWorkloadDeductionStaffSummary[];
  total: AcademicWorkloadDeductionSummaryTotal;
  truncationReason: string | null;
};

export type AcademicWorkloadDeductionSummaryQueryResult = {
  summary: AcademicWorkloadDeductionSummaryEnvelope;
};

export type RequestAcademicWorkloadDeductionSummaryInput = {
  endDate?: string;
  includeSportsMeetDeductions?: boolean;
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
    $includeSportsMeetDeductions: Boolean
  ) {
    getAcademicWorkloadDeductionSummary(
      semesterId: $semesterId
      workloadDepartmentId: $workloadDepartmentId
      teacherEngagementType: $teacherEngagementType
      startDate: $startDate
      endDate: $endDate
      includeSportsMeetDeductions: $includeSportsMeetDeductions
    ) {
      isValid
      invalidReason
      isComplete
      truncationReason
      dateColumns {
        date
        isRepeatedTeachingDate
      }
      total {
        itemCount
        staffCount
        baselineHours
        deductedHours
        addedHours
        residualDeductedHours
        repeatedHours
        netAdjustmentHours
      }
      departmentSummaries {
        workloadDepartmentId
        workloadDepartmentName
        itemCount
        staffCount
        baselineHours
        deductedHours
        addedHours
        residualDeductedHours
        repeatedHours
        netAdjustmentHours
      }
      staffSummaries {
        workloadDepartmentId
        staffId
        itemCount
        residualDeductedHours
        repeatedHours
        netAdjustmentHours
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
        residualDeductedHours
        repeatedHours
        netAdjustmentHours
        dateAdjustments {
          date
          residualDeductedHours
          repeatedHours
          netAdjustmentHours
          deductionSourceEventTypes
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
    includeSportsMeetDeductions: input.includeSportsMeetDeductions,
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

    return {
      summary: response.getAcademicWorkloadDeductionSummary,
    } satisfies AcademicWorkloadDeductionSummaryQueryResult;
  } catch (error) {
    throw new Error(
      resolveAcademicWorkloadDeductionSummaryErrorMessage(error, '暂时无法加载教师扣课汇总。'),
    );
  }
}
