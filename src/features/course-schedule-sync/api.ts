import type { OperationVariables } from '@apollo/client';

import {
  executeGraphQL,
  isExpiredUpstreamSessionError,
  readUpstreamGraphQLErrorDetail,
  resolveUpstreamErrorMessage,
} from '@/shared/graphql';

export { isExpiredUpstreamSessionError };

export type DepartmentCurriculumPlanReviewStatus =
  | 'APPROVED'
  | 'PENDING_SUBMIT'
  | 'REJECTED'
  | 'UNDER_REVIEW'
  | 'UNRECORDED';

export type CourseScheduleSyncItem = {
  action: string;
  scheduleId: number;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
};

export type CourseScheduleSyncFailure = {
  code: string;
  details?: unknown;
  message: string;
  sstsCourseId: string | null;
  sstsTeachingClassId: string | null;
};

export type CourseScheduleSyncResult = {
  createdCount: number;
  expiresAt: string;
  failedCount: number;
  failures: CourseScheduleSyncFailure[];
  fetchedCount: number;
  importedCount: number;
  items: CourseScheduleSyncItem[];
  semesterId: number;
  upstreamSessionToken: string;
  updatedCount: number;
};

export type CurrentCourseScheduleSyncAccount = {
  accountId: number;
  displayName: string;
};

export type CourseScheduleSyncSemesterOption = {
  id: number;
  isCurrent: boolean;
  schoolYear: number;
  termNumber: number;
};

export type CourseScheduleSyncDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

type LoginUpstreamSessionResponse = {
  loginUpstreamSession: {
    expiresAt: string;
    upstreamSessionToken: string;
  };
};

type CurrentAccountResponse = {
  me: {
    accountId: number;
    userInfo: {
      nickname: string | null;
    };
  };
};

type AcademicSemestersResponse = {
  academicSemesters: CourseScheduleSyncSemesterOption[];
};

type DepartmentOptionsResponse = {
  departments: CourseScheduleSyncDepartmentOption[];
};

type SyncCourseSchedulesResponse = {
  syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans: CourseScheduleSyncResult;
};

const LOGIN_UPSTREAM_SESSION_MUTATION = `
  mutation LoginUpstreamSession($input: LoginUpstreamSessionInput!) {
    loginUpstreamSession(input: $input) {
      expiresAt
      upstreamSessionToken
    }
  }
`;

const SYNC_COURSE_SCHEDULES_MUTATION = `
  mutation SyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(
    $input: SyncCourseSchedulesFromUpstreamDepartmentCurriculumPlansInput!
  ) {
    syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(input: $input) {
      upstreamSessionToken
      expiresAt
      semesterId
      fetchedCount
      importedCount
      createdCount
      updatedCount
      failedCount
      items {
        action
        scheduleId
        sstsCourseId
        sstsTeachingClassId
      }
      failures {
        code
        message
        details
        sstsCourseId
        sstsTeachingClassId
      }
    }
  }
`;

const CURRENT_ACCOUNT_QUERY = `
  query Me {
    me {
      accountId
      userInfo {
        nickname
      }
    }
  }
`;

const ACADEMIC_SEMESTERS_QUERY = `
  query CourseScheduleSyncAcademicSemesters($limit: Int) {
    academicSemesters(limit: $limit) {
      id
      isCurrent
      schoolYear
      termNumber
    }
  }
`;

const DEPARTMENTS_QUERY = `
  query CourseScheduleSyncDepartments($limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

export async function loginUpstreamSession(input: { password: string; userId: string }) {
  try {
    const response = await requestGraphQL<
      LoginUpstreamSessionResponse,
      {
        input: {
          password: string;
          userId: string;
        };
      }
    >(LOGIN_UPSTREAM_SESSION_MUTATION, {
      input,
    });

    return response.loginUpstreamSession;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法登录 upstream。'));
  }
}

export async function fetchCurrentCourseScheduleSyncAccount(): Promise<CurrentCourseScheduleSyncAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    return {
      accountId: response.me.accountId,
      displayName: response.me.userInfo.nickname?.trim() || `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function fetchCourseScheduleSyncSemesterOptions() {
  try {
    const response = await requestGraphQL<
      AcademicSemestersResponse,
      {
        limit: number;
      }
    >(ACADEMIC_SEMESTERS_QUERY, { limit: 500 });

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载学期列表。'));
  }
}

export async function fetchCourseScheduleSyncDepartmentOptions() {
  try {
    const response = await requestGraphQL<
      DepartmentOptionsResponse,
      {
        limit: number;
      }
    >(DEPARTMENTS_QUERY, { limit: 500 });

    return response.departments;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载院系列表。'));
  }
}

export async function syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(input: {
  coefficient?: string;
  departmentId: string;
  reviewStatus?: DepartmentCurriculumPlanReviewStatus;
  schoolYear: string;
  semester: string;
  teacherId?: string;
  upstreamSessionToken: string;
}) {
  const response = await requestGraphQL<
    SyncCourseSchedulesResponse,
    {
      input: {
        coefficient?: string;
        departmentId: string;
        reviewStatus?: DepartmentCurriculumPlanReviewStatus;
        schoolYear: string;
        semester: string;
        teacherId?: string;
        upstreamSessionToken: string;
      };
    }
  >(SYNC_COURSE_SCHEDULES_MUTATION, {
    input: {
      coefficient: input.coefficient?.trim() || undefined,
      departmentId: input.departmentId.trim(),
      reviewStatus: input.reviewStatus,
      schoolYear: String(input.schoolYear || '').trim(),
      semester: String(input.semester || '').trim(),
      teacherId: input.teacherId?.trim() || undefined,
      upstreamSessionToken: input.upstreamSessionToken,
    },
  });

  return response.syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans;
}

export function isAcademicSemesterNotFoundError(error: unknown) {
  const detail = readUpstreamGraphQLErrorDetail(error);

  if (
    detail?.code === 'ACADEMIC_SEMESTER_NOT_FOUND' ||
    detail?.errorCode === 'ACADEMIC_SEMESTER_NOT_FOUND'
  ) {
    return true;
  }

  const message = detail?.message || (error instanceof Error ? error.message : '');

  return message.includes('ACADEMIC_SEMESTER_NOT_FOUND');
}

export function resolveCourseScheduleSyncErrorMessage(error: unknown) {
  if (isAcademicSemesterNotFoundError(error)) {
    return '当前学年与学期在本地 academic semester 中不存在，请先补齐学期数据后再同步。';
  }

  return resolveUpstreamErrorMessage(error, '暂时无法同步课程表。');
}
