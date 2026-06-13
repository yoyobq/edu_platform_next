// src/labs/student-course-results-pull/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
  normalizeTextListValue,
} from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

export type StudentCourseResultsPullAccount = {
  accountId: number;
  displayName: string;
};

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
  annualMajorId: string | null;
  attendExamType: string | null;
  classCode: string | null;
  courseDivide: string | null;
  courseId: string | null;
  courseName: string | null;
  courseNature: string | null;
  departmentId: string | null;
  grade: string | null;
  isPass: boolean | null;
  periodicFinalTotalScore: string | number | null;
  schoolYear: string | null;
  semester: string | null;
  studentName: string | null;
  studentNumber: string | null;
  teacherName: string | null;
  totalScore: string | number | null;
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
  expiresAt: string | null;
  failedStudentCount: number;
  failures: StudentCourseResultsFailure[];
  items: StudentCourseResultsItem[];
  rowCount: number;
  sessionStrategy: string | null;
  studentCount: number;
  upstreamFetchedStudentCount: number;
  upstreamSessionToken: string | null;
};

export type FetchClassStudentCourseResultsInput = {
  classCode: string;
  refreshMode: StudentCourseResultsRefreshMode;
  schoolYear?: string | null;
  semester?: string | null;
  sessionToken?: string | null;
  studentNumbers?: readonly string[] | null;
};

type CurrentAccountResponse = {
  me: {
    accountId: number;
    account: {
      identityHint: string | null;
    };
    identity:
      | {
          __typename: 'StaffType';
          id: string;
          name: string | null;
        }
      | {
          __typename: 'StudentType';
          id: string;
          name: string | null;
        }
      | null;
    userInfo: {
      nickname: string | null;
    };
  };
};

type ListLocalClassOptionsResponse = {
  listLocalClassOptions: LocalClassOption[];
};

type DepartmentsResponse = {
  departments: LocalDepartmentOption[];
};

type FetchClassStudentCourseResultsResponse = {
  fetchClassStudentCourseResults: StudentCourseResultsResult;
};

const CURRENT_ACCOUNT_QUERY = `
  query StudentCourseResultsPullCurrentAccount {
    me {
      accountId
      account {
        identityHint
      }
      userInfo {
        nickname
      }
      identity {
        __typename
        ... on StaffType {
          id
          name
        }
        ... on StudentType {
          id
          name
        }
      }
    }
  }
`;

const LIST_LOCAL_CLASS_OPTIONS_QUERY = `
  query StudentCourseResultsPullLocalClassOptions($input: ListLocalClassOptionsInput) {
    listLocalClassOptions(input: $input) {
      id
      departmentId
      classCode
      className
      gradeYear
    }
  }
`;

const DEPARTMENTS_QUERY = `
  query StudentCourseResultsPullDepartments($isEnabled: Boolean, $limit: Int) {
    departments(isEnabled: $isEnabled, limit: $limit) {
      id
      departmentName
      isEnabled
      shortName
    }
  }
`;

const FETCH_CLASS_STUDENT_COURSE_RESULTS_MUTATION = `
  mutation FetchClassStudentCourseResults($input: FetchClassStudentCourseResultsInput!) {
    fetchClassStudentCourseResults(input: $input) {
      upstreamSessionToken
      expiresAt
      sessionStrategy
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
          studentNumber
          studentName
          schoolYear
          semester
          grade
          departmentId
          annualMajorId
          classCode
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

function normalizeDisplayName(response: CurrentAccountResponse['me']) {
  return (
    response.identity?.name?.trim() ||
    response.userInfo.nickname?.trim() ||
    response.account.identityHint?.trim() ||
    response.identity?.id?.trim() ||
    `account-${response.accountId}`
  );
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
    refreshMode: input.refreshMode,
    schoolYear: normalizeOptionalTextValue(input.schoolYear, 'to_undefined'),
    semester: normalizeOptionalTextValue(input.semester, 'to_undefined'),
    sessionToken: normalizeOptionalTextValue(input.sessionToken, 'to_undefined'),
    studentNumbers: studentNumbers.length > 0 ? studentNumbers : undefined,
  });
}

export async function fetchCurrentStudentCourseResultsPullAccount() {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    return {
      accountId: response.me.accountId,
      displayName: normalizeDisplayName(response.me),
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
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
