// src/features/academic-integrated-plan-corrections/infrastructure/academic-integrated-plan-corrections-api.ts
import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export type IntegratedPlanCorrectionDiff = string;
export type IntegratedPlanCorrectionAlignmentStatus = 'CURRENT_ONLY' | 'EXPECTED_ONLY' | 'MATCHED';

export type IntegratedPlanCorrectionCurrentPlan = {
  learningSessionContent: string | null;
  learningSessionNo: number | null;
  learningTaskName: string | null;
  learningTaskNo: number | null;
  lessonHours: number | null;
  teachingUnitName: string | null;
  teachingUnitNo: number | null;
  weekNumber: number | null;
};

export type IntegratedPlanCorrectionOccurrence = {
  date: string;
  dayOfWeek: number;
  lessonHours: number;
  periodEnd: number;
  periodStart: number;
  weekNumber: number;
};

export type IntegratedPlanCorrectionSuggestedPlan = {
  firstWeekNumber: number | null;
  lessonHours: number | null;
  suggestedOccurrences: IntegratedPlanCorrectionOccurrence[];
};

export type IntegratedPlanCorrectionSuggestion = {
  blockingIssue: string | null;
  cascadeFromGroupRoot: boolean;
  currentPlan: IntegratedPlanCorrectionCurrentPlan;
  diffs: IntegratedPlanCorrectionDiff[];
  lecturePlanDetailId: string | null;
  suggested: IntegratedPlanCorrectionSuggestedPlan;
};

export type IntegratedPlanCorrectionRepairGroup = {
  affectedDetailIds: string[];
  blockingIssue: string | null;
  diffs: IntegratedPlanCorrectionDiff[];
  endOriginalIndex: number | null;
  id: string;
  lecturePlanId: string | null;
  rootLecturePlanDetailId: string | null;
  startOriginalIndex: number | null;
  suggestions: IntegratedPlanCorrectionSuggestion[];
  teachingClassId: string | null;
};

export type IntegratedPlanCorrectionItem = IntegratedPlanCorrectionSuggestion & {
  alignmentStatus: IntegratedPlanCorrectionAlignmentStatus;
  courseName: string | null;
  currentOriginalIndex: number | null;
  expectedIndex: number | null;
  lecturePlanId: string | null;
  repairGroupId: string | null;
  teachingClassId: string | null;
  teachingClassName: string | null;
};

export type IntegratedPlanCorrectionSummary = {
  affectedDetailCount: number;
  blockingIssueCount: number;
  detailCount: number;
  planCount: number;
  repairGroupCount: number;
};

export type IntegratedPlanCorrectionTeachingClassGroup = {
  courseName: string | null;
  endOriginalIndex: number;
  id: string;
  itemOriginalIndexes: number[];
  lecturePlanId: string | null;
  repairGroupIds: string[];
  startOriginalIndex: number;
  teachingClassId: string | null;
  teachingClassName: string | null;
};

export type IntegratedPlanCorrectionSuggestionsResult = {
  expiresAt: string | null;
  items: IntegratedPlanCorrectionItem[];
  repairGroups: IntegratedPlanCorrectionRepairGroup[];
  summary: IntegratedPlanCorrectionSummary;
  teachingClassGroups: IntegratedPlanCorrectionTeachingClassGroup[];
  upstreamSessionToken: string | null;
};

export type ListIntegratedPlanCorrectionSuggestionsInput = {
  lecturePlanId?: string;
  semesterId: number;
  staffId: string;
  teachingClassId?: string;
  upstreamSessionToken: string;
};

type ListIntegratedPlanCorrectionSuggestionsResponse = {
  listAcademicIntegratedPlanCorrectionSuggestions: IntegratedPlanCorrectionSuggestionsResult;
};

export type ListMyIntegratedPlanCorrectionSuggestionsInput = {
  semesterId: number;
  upstreamSessionToken: string;
};

type ListMyIntegratedPlanCorrectionSuggestionsResponse = {
  listMyAcademicIntegratedPlanCorrectionSuggestions: IntegratedPlanCorrectionSuggestionsResult;
};

const LIST_INTEGRATED_PLAN_CORRECTION_SUGGESTIONS_QUERY = `
  query ListAcademicIntegratedPlanCorrectionSuggestions(
    $lecturePlanId: String
    $semesterId: Int!
    $staffId: String!
    $teachingClassId: String
    $upstreamSessionToken: String!
  ) {
    listAcademicIntegratedPlanCorrectionSuggestions(
      lecturePlanId: $lecturePlanId
      semesterId: $semesterId
      staffId: $staffId
      teachingClassId: $teachingClassId
      upstreamSessionToken: $upstreamSessionToken
    ) {
      summary {
        planCount
        detailCount
        repairGroupCount
        affectedDetailCount
        blockingIssueCount
      }
      teachingClassGroups {
        id
        lecturePlanId
        teachingClassId
        courseName
        teachingClassName
        startOriginalIndex
        endOriginalIndex
        itemOriginalIndexes
        repairGroupIds
      }
      repairGroups {
        id
        rootLecturePlanDetailId
        lecturePlanId
        teachingClassId
        startOriginalIndex
        endOriginalIndex
        affectedDetailIds
        diffs
        blockingIssue
        suggestions {
          lecturePlanDetailId
          cascadeFromGroupRoot
          diffs
          blockingIssue
          currentPlan {
            weekNumber
            lessonHours
            learningTaskNo
            learningTaskName
            learningSessionNo
            learningSessionContent
            teachingUnitNo
            teachingUnitName
          }
          suggested {
            firstWeekNumber
            lessonHours
            suggestedOccurrences {
              date
              weekNumber
              dayOfWeek
              periodStart
              periodEnd
              lessonHours
            }
          }
        }
      }
      items {
        alignmentStatus
        lecturePlanId
        lecturePlanDetailId
        teachingClassId
        courseName
        teachingClassName
        currentOriginalIndex
        expectedIndex
        diffs
        blockingIssue
        repairGroupId
        cascadeFromGroupRoot
        currentPlan {
          weekNumber
          lessonHours
          learningTaskNo
          learningTaskName
          learningSessionNo
          learningSessionContent
          teachingUnitNo
          teachingUnitName
        }
        suggested {
          firstWeekNumber
          lessonHours
          suggestedOccurrences {
            date
            weekNumber
            dayOfWeek
            periodStart
            periodEnd
            lessonHours
          }
        }
      }
      upstreamSessionToken
      expiresAt
    }
  }
`;

const LIST_MY_INTEGRATED_PLAN_CORRECTION_SUGGESTIONS_QUERY = `
  query ListMyAcademicIntegratedPlanCorrectionSuggestions(
    $semesterId: Int!
    $upstreamSessionToken: String!
  ) {
    listMyAcademicIntegratedPlanCorrectionSuggestions(
      semesterId: $semesterId
      upstreamSessionToken: $upstreamSessionToken
    ) {
      summary {
        planCount
        detailCount
        repairGroupCount
        affectedDetailCount
        blockingIssueCount
      }
      teachingClassGroups {
        id
        lecturePlanId
        teachingClassId
        courseName
        teachingClassName
        startOriginalIndex
        endOriginalIndex
        itemOriginalIndexes
        repairGroupIds
      }
      repairGroups {
        id
        rootLecturePlanDetailId
        lecturePlanId
        teachingClassId
        startOriginalIndex
        endOriginalIndex
        affectedDetailIds
        diffs
        blockingIssue
        suggestions {
          lecturePlanDetailId
          cascadeFromGroupRoot
          diffs
          blockingIssue
          currentPlan {
            weekNumber
            lessonHours
            learningTaskNo
            learningTaskName
            learningSessionNo
            learningSessionContent
            teachingUnitNo
            teachingUnitName
          }
          suggested {
            firstWeekNumber
            lessonHours
            suggestedOccurrences {
              date
              weekNumber
              dayOfWeek
              periodStart
              periodEnd
              lessonHours
            }
          }
        }
      }
      items {
        alignmentStatus
        lecturePlanId
        lecturePlanDetailId
        teachingClassId
        courseName
        teachingClassName
        currentOriginalIndex
        expectedIndex
        diffs
        blockingIssue
        repairGroupId
        cascadeFromGroupRoot
        currentPlan {
          weekNumber
          lessonHours
          learningTaskNo
          learningTaskName
          learningSessionNo
          learningSessionContent
          teachingUnitNo
          teachingUnitName
        }
        suggested {
          firstWeekNumber
          lessonHours
          suggestedOccurrences {
            date
            weekNumber
            dayOfWeek
            periodStart
            periodEnd
            lessonHours
          }
        }
      }
      upstreamSessionToken
      expiresAt
    }
  }
`;

const UPSTREAM_SESSION_GRAPHQL_OPTIONS = {
  logoutOnRetryAuthFailure: false,
} as const;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options?: {
    logoutOnRetryAuthFailure?: boolean;
  },
): Promise<TData> {
  return options ? executeGraphQL(query, variables, options) : executeGraphQL(query, variables);
}

function normalizeOptionalString(value?: string) {
  return normalizeOptionalTextValue(value, 'to_undefined');
}

function normalizeInput(input: ListIntegratedPlanCorrectionSuggestionsInput) {
  return {
    lecturePlanId: normalizeOptionalString(input.lecturePlanId),
    semesterId: input.semesterId,
    staffId: normalizeRequiredTextValue(String(input.staffId || ''), {
      message: 'staffId 为必填。',
    }),
    teachingClassId: normalizeOptionalString(input.teachingClassId),
    upstreamSessionToken: normalizeRequiredTextValue(String(input.upstreamSessionToken || ''), {
      message: 'upstreamSessionToken 为必填。',
    }),
  };
}

function normalizeMyInput(input: ListMyIntegratedPlanCorrectionSuggestionsInput) {
  return {
    semesterId: input.semesterId,
    upstreamSessionToken: normalizeRequiredTextValue(String(input.upstreamSessionToken || ''), {
      message: 'upstreamSessionToken 为必填。',
    }),
  };
}

export async function listIntegratedPlanCorrectionSuggestions(
  input: ListIntegratedPlanCorrectionSuggestionsInput,
) {
  try {
    const response = await requestGraphQL<
      ListIntegratedPlanCorrectionSuggestionsResponse,
      ReturnType<typeof normalizeInput>
    >(
      LIST_INTEGRATED_PLAN_CORRECTION_SUGGESTIONS_QUERY,
      normalizeInput(input),
      UPSTREAM_SESSION_GRAPHQL_OPTIONS,
    );

    return response.listAcademicIntegratedPlanCorrectionSuggestions;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载一体化计划修正建议。'));
  }
}

export async function listMyIntegratedPlanCorrectionSuggestions(
  input: ListMyIntegratedPlanCorrectionSuggestionsInput,
) {
  try {
    const response = await requestGraphQL<
      ListMyIntegratedPlanCorrectionSuggestionsResponse,
      ReturnType<typeof normalizeMyInput>
    >(
      LIST_MY_INTEGRATED_PLAN_CORRECTION_SUGGESTIONS_QUERY,
      normalizeMyInput(input),
      UPSTREAM_SESSION_GRAPHQL_OPTIONS,
    );

    return response.listMyAcademicIntegratedPlanCorrectionSuggestions;
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载一体化计划修正建议。'));
  }
}
