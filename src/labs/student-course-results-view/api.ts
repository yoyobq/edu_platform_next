// src/labs/student-course-results-view/api.ts

import type { OperationVariables } from '@apollo/client';

import { resolveUpstreamErrorMessage } from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
  normalizeTextListValue,
} from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { resolveUpstreamErrorMessage };

export type StudentCourseResultsRefreshMode = 'CACHE_FIRST' | 'REFRESH' | 'UPSTREAM_ONLY';
export type StudentCourseResultsSource = 'CACHE' | 'STALE_CACHE' | 'UPSTREAM';

export type LocalClassOption = {
  classCode: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
};

export type LocalDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type ListLocalClassOptionsInput = {
  departmentId?: string | null;
  keyword?: string | null;
};

export type StudentCourseResultRecord = {
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

export type StudentCourseResultsItem = {
  fetchedAt: string | null;
  results: StudentCourseResultRecord[];
  source: StudentCourseResultsSource;
  studentName: string | null;
  studentNumber: string;
};

export type StudentCourseResultsFailure = {
  code: string;
  message: string;
  studentName: string | null;
  studentNumber: string;
};

export type StudentCourseResultsResult = {
  cacheHitStudentCount: number;
  classCode: string;
  className: string | null;
  failedStudentCount: number;
  failures: StudentCourseResultsFailure[];
  items: StudentCourseResultsItem[];
  rowCount: number;
  studentCount: number;
  upstreamFetchedStudentCount: number;
};

export type FetchClassStudentCourseResultsInput = {
  classCode: string;
  refreshMode?: StudentCourseResultsRefreshMode;
  schoolYear?: string | null;
  semester?: string | null;
  studentNumbers?: readonly string[] | null;
};

type DepartmentsResponse = {
  departments: LocalDepartmentOption[];
};

type ListLocalClassOptionsResponse = {
  listLocalClassOptions: LocalClassOption[];
};

type FetchClassStudentCourseResultsResponse = {
  fetchClassStudentCourseResults: StudentCourseResultsResult;
};

const DEPARTMENTS_QUERY = `
  query StudentCourseResultsViewDepartments($isEnabled: Boolean, $limit: Int) {
    departments(isEnabled: $isEnabled, limit: $limit) {
      id
      departmentName
      isEnabled
      shortName
    }
  }
`;

const LIST_LOCAL_CLASS_OPTIONS_QUERY = `
  query StudentCourseResultsViewLocalClassOptions($input: ListLocalClassOptionsInput) {
    listLocalClassOptions(input: $input) {
      id
      departmentId
      classCode
      className
      gradeYear
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
      failedStudentCount
      cacheHitStudentCount
      upstreamFetchedStudentCount
      items {
        studentNumber
        studentName
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
      failures {
        studentNumber
        studentName
        code
        message
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

export function normalizeListLocalClassOptionsInput(input: ListLocalClassOptionsInput = {}) {
  return compactInput({
    departmentId: normalizeOptionalTextValue(input.departmentId, 'to_undefined'),
    keyword: normalizeOptionalTextValue(input.keyword, 'to_undefined'),
  });
}

export function normalizeFetchClassStudentCourseResultsInput(
  input: FetchClassStudentCourseResultsInput,
) {
  const studentNumbers = normalizeTextListValue([...(input.studentNumbers ?? [])], {
    dedupe: true,
    emptyItemPolicy: 'filter',
  });

  return compactInput({
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级 classCode' }),
    refreshMode: input.refreshMode ?? 'CACHE_FIRST',
    schoolYear: normalizeOptionalTextValue(input.schoolYear, 'to_undefined'),
    semester: normalizeOptionalTextValue(input.semester, 'to_undefined'),
    studentNumbers: studentNumbers.length > 0 ? studentNumbers : undefined,
  });
}

export async function listLocalDepartmentOptions() {
  try {
    const response = await requestGraphQL<
      DepartmentsResponse,
      {
        isEnabled: boolean;
        limit: number;
      }
    >(DEPARTMENTS_QUERY, {
      isEnabled: true,
      limit: 500,
    });

    return response.departments;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载系部列表。'));
  }
}

export async function listLocalClassOptions(input: ListLocalClassOptionsInput = {}) {
  try {
    const response = await requestGraphQL<
      ListLocalClassOptionsResponse,
      {
        input: ReturnType<typeof normalizeListLocalClassOptionsInput>;
      }
    >(LIST_LOCAL_CLASS_OPTIONS_QUERY, {
      input: normalizeListLocalClassOptionsInput(input),
    });

    return response.listLocalClassOptions;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载本地班级列表。'));
  }
}

export async function fetchClassStudentCourseResults(input: FetchClassStudentCourseResultsInput) {
  const response = await requestGraphQL<
    FetchClassStudentCourseResultsResponse,
    {
      input: ReturnType<typeof normalizeFetchClassStudentCourseResultsInput>;
    }
  >(FETCH_CLASS_STUDENT_COURSE_RESULTS_MUTATION, {
    input: normalizeFetchClassStudentCourseResultsInput(input),
  });

  return response.fetchClassStudentCourseResults;
}
