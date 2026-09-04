// src/features/academic-split-joint-teaching/infrastructure/academic-split-joint-teaching-api.ts
import type { OperationVariables } from '@apollo/client';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type AcademicSplitJointTeachingCandidateCohort = {
  dayOfWeek: number;
  exceptionalWeekIndexes: number[];
  periodEnd: number;
  periodStart: number;
  sharedWeekIndexes: number[];
  teachingClassNames: string[];
};

export type AcademicSplitJointTeachingCandidate = {
  cohorts: AcademicSplitJointTeachingCandidateCohort[];
  confirmed: boolean;
  courseName: string | null;
  invalidReason: string | null;
  isActiveCandidate: boolean;
  originalBudgetHours: string;
  originalEffectiveHours: string;
  semanticBudgetHours: string;
  semanticEffectiveHours: string;
  semesterId: number;
  staffId: string;
  staffName: string;
  sstsCourseId: string;
};

type AcademicSplitJointTeachingCandidatesResponse = {
  listAcademicSplitJointTeachingCandidates: {
    items: AcademicSplitJointTeachingCandidate[];
  };
};

type AcademicSemestersResponse = {
  academicSemesters: AcademicSemesterRecord[];
};

type SetAcademicSplitJointTeachingConfirmationResponse = {
  setAcademicSplitJointTeachingConfirmation: {
    confirmed: boolean;
    semesterId: number;
    staffId: string;
    sstsCourseId: string;
  };
};

const LIST_CANDIDATES_QUERY = `
  query ListAcademicSplitJointTeachingCandidates($semesterId: Int!) {
    listAcademicSplitJointTeachingCandidates(semesterId: $semesterId) {
      items {
        semesterId
        staffId
        staffName
        sstsCourseId
        courseName
        originalBudgetHours
        semanticBudgetHours
        originalEffectiveHours
        semanticEffectiveHours
        confirmed
        isActiveCandidate
        invalidReason
        cohorts {
          dayOfWeek
          periodStart
          periodEnd
          teachingClassNames
          sharedWeekIndexes
          exceptionalWeekIndexes
        }
      }
    }
  }
`;

const LIST_SEMESTERS_QUERY = `
  query SplitJointTeachingSemesters($isVisible: Boolean, $limit: Int) {
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

const SET_CONFIRMATION_MUTATION = `
  mutation SetAcademicSplitJointTeachingConfirmation(
    $input: SetAcademicSplitJointTeachingConfirmationInput!
  ) {
    setAcademicSplitJointTeachingConfirmation(input: $input) {
      semesterId
      staffId
      sstsCourseId
      confirmed
    }
  }
`;

function resolveErrorMessage(error: unknown, fallback: string) {
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

export async function requestAcademicSplitJointTeachingCandidates(semesterId: number) {
  try {
    const response = await executeGraphQL<
      AcademicSplitJointTeachingCandidatesResponse,
      OperationVariables & { semesterId: number }
    >(LIST_CANDIDATES_QUERY, { semesterId });

    return response.listAcademicSplitJointTeachingCandidates.items;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法加载拆分合班候选。'));
  }
}

export async function requestAcademicSplitJointTeachingSemesters() {
  try {
    const response = await executeGraphQL<
      AcademicSemestersResponse,
      OperationVariables & { isVisible: boolean; limit: number }
    >(LIST_SEMESTERS_QUERY, { isVisible: true, limit: 100 });

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法加载学期列表。'));
  }
}

export async function setAcademicSplitJointTeachingConfirmation(input: {
  confirmed: boolean;
  semesterId: number;
  staffId: string;
  sstsCourseId: string;
}) {
  try {
    const response = await executeGraphQL<
      SetAcademicSplitJointTeachingConfirmationResponse,
      OperationVariables & { input: typeof input }
    >(SET_CONFIRMATION_MUTATION, { input });

    return response.setAcademicSplitJointTeachingConfirmation;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法更新拆分合班确认。'));
  }
}
