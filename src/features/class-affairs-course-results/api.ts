// src/features/class-affairs-course-results/api.ts

import type { OperationVariables } from '@apollo/client';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';
import {
  executeUpstreamSessionGraphQL,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { resolveUpstreamErrorMessage };

export type ManagedCourseResultsRefreshMode = 'CACHE_FIRST' | 'REFRESH';
export type ManagedCourseResultsSource = 'CACHE' | 'STALE_CACHE' | 'UPSTREAM';
export type ManagedCourseResultsStudentStatus =
  | 'PRE_REGISTERED'
  | 'NOT_CHECKED_IN'
  | 'ENROLLED'
  | 'OFF_CAMPUS_INTERNSHIP'
  | 'SUSPENDED'
  | 'GRADUATED'
  | 'DROPPED';
export type ManagedCourseResultsDisplayStatus = 'NORMAL' | 'SPECIAL_CASE';
export type ManagedCourseResultsDisplayDecisionOutcome = 'INCLUDE' | 'EXCLUDE';
export type ManagedCourseResultsDisplayReasonCode =
  | 'DROPPED_CONFIRMED'
  | 'TRANSFERRED_OUT_CONFIRMED'
  | 'TRANSFERRED_IN_CONFIRMED'
  | 'RETAINED_GRADE_CONFIRMED'
  | 'REENROLLED_CONFIRMED'
  | 'UPSTREAM_ROSTER_ERROR_CONFIRMED'
  | 'CLASS_MEMBERSHIP_CORRECTION';

export type ListAcademicSemestersInput = {
  isCurrent?: boolean;
  isVisible?: boolean;
  limit?: number;
  schoolYear?: number;
  termNumber?: number;
};

type AcademicSemestersResponse = {
  academicSemesters: AcademicSemesterRecord[];
};

export type ManagedClassCourseResultsClass = {
  classCode: string | null;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
};

export type ManagedClassCourseResultsTerm = {
  canPullFromUpstream: boolean;
  disabledReason: string | null;
  hasLocalData: boolean;
  id: number | null;
  isCurrent: boolean;
  label: string;
  schoolYear: string;
  semester: string;
};

export type ManagedCourseResultRecord = {
  attendExamType: string | null;
  courseDivide: string | null;
  courseId: string | null;
  courseName: string | null;
  courseNature: string | null;
  isPass: number | null;
  periodicFinalTotalScore: string | null;
  schoolYear: string | null;
  semester: string | null;
  teacherName: string | null;
  totalScore: string | null;
};

export type ManagedCourseResultsItem = {
  fetchedAt: string | null;
  results: ManagedCourseResultRecord[];
  resultDisplayDecisionOutcome: ManagedCourseResultsDisplayDecisionOutcome | null;
  resultDisplayEffectiveSemesterId: number | null;
  resultDisplayMessage: string | null;
  resultDisplayReasonCode: ManagedCourseResultsDisplayReasonCode | null;
  resultDisplayStatus: ManagedCourseResultsDisplayStatus;
  source: ManagedCourseResultsSource;
  studentName: string | null;
  studentNumber: string;
  studentStatus: ManagedCourseResultsStudentStatus | null;
};

export type ManagedCourseResultsResult = {
  classCode: string;
  className: string | null;
  expiresAt?: string | null;
  items: ManagedCourseResultsItem[];
  rowCount: number;
  studentCount: number;
  upstreamSessionToken?: string | null;
};

export type FetchManagedClassCourseResultsInput = {
  classCode: string;
  refreshMode: ManagedCourseResultsRefreshMode;
  schoolYear?: string | null;
  semester?: string | null;
  upstreamSessionToken?: string | null;
};

type MyManagedClassesResponse = {
  myManagedClasses: ManagedClassCourseResultsClass[];
};

type FetchResultsResponse = {
  fetchClassStudentCourseResults: ManagedCourseResultsResult;
};

const MY_MANAGED_CLASSES_QUERY = `
  query MyManagedClasses {
    myManagedClasses {
      id
      departmentId
      classCode
      className
      gradeYear
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

const FETCH_CLASS_STUDENT_COURSE_RESULTS_MUTATION = `
  mutation FetchClassStudentCourseResults($input: FetchClassStudentCourseResultsInput!) {
    fetchClassStudentCourseResults(input: $input) {
      classCode
      className
      studentCount
      rowCount
      upstreamSessionToken
      expiresAt
      items {
        studentNumber
        studentName
        studentStatus
        resultDisplayStatus
        resultDisplayDecisionOutcome
        resultDisplayReasonCode
        resultDisplayEffectiveSemesterId
        resultDisplayMessage
        source
        fetchedAt
        results {
          schoolYear
          semester
          courseId
          courseName
          teacherName
          totalScore
          isPass
          courseNature
          courseDivide
          attendExamType
          periodicFinalTotalScore
        }
      }
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function compactInput<TValue extends Record<string, unknown>>(input: TValue) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<TValue>;
}

export function normalizeFetchManagedClassCourseResultsInput(
  input: FetchManagedClassCourseResultsInput,
) {
  return compactInput({
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级' }),
    refreshMode: input.refreshMode,
    schoolYear: normalizeOptionalTextValue(input.schoolYear, 'to_undefined'),
    semester: normalizeOptionalTextValue(input.semester, 'to_undefined'),
    sessionToken: normalizeOptionalTextValue(input.upstreamSessionToken, 'to_undefined'),
  });
}

export async function listMyManagedClasses() {
  try {
    const response = await requestGraphQL<MyManagedClassesResponse, Record<string, never>>(
      MY_MANAGED_CLASSES_QUERY,
      {},
    );

    return response.myManagedClasses;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载本地负责班级。'));
  }
}

export async function requestAcademicSemesters(input: ListAcademicSemestersInput = {}) {
  try {
    const response = await requestGraphQL<
      AcademicSemestersResponse,
      OperationVariables & ListAcademicSemestersInput
    >(LIST_ACADEMIC_SEMESTERS_QUERY, input);

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载学期列表。'));
  }
}

export async function fetchManagedClassCourseResults(input: FetchManagedClassCourseResultsInput) {
  const variables = {
    input: normalizeFetchManagedClassCourseResultsInput(input),
  };
  const fetchResults = variables.input.sessionToken
    ? executeUpstreamSessionGraphQL
    : requestGraphQL;
  const response = await fetchResults<
    FetchResultsResponse,
    {
      input: ReturnType<typeof normalizeFetchManagedClassCourseResultsInput>;
    }
  >(FETCH_CLASS_STUDENT_COURSE_RESULTS_MUTATION, variables);

  return response.fetchClassStudentCourseResults;
}
