import type { OperationVariables } from '@apollo/client';

import { requestAcademicSemesters } from '@/entities/academic-semester';
import {
  isExpiredUpstreamSessionError,
  readUpstreamGraphQLErrorDetail,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { executeGraphQL } from '@/shared/graphql';

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

type DepartmentOptionsResponse = {
  departments: CourseScheduleSyncDepartmentOption[];
};

type SyncCourseSchedulesResponse = {
  syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans: CourseScheduleSyncResult;
};

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

const DEPARTMENTS_QUERY = `
  query CourseScheduleSyncDepartments($isEnabled: Boolean, $limit: Int) {
    departments(isEnabled: $isEnabled, limit: $limit) {
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

export async function fetchCourseScheduleSyncSemesterOptions() {
  try {
    const response = await requestAcademicSemesters({ limit: 500 });

    return response.map((semester) => ({
      id: semester.id,
      isCurrent: semester.isCurrent,
      schoolYear: semester.schoolYear,
      termNumber: semester.termNumber,
    }));
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载学期列表。'));
  }
}

export async function fetchCourseScheduleSyncDepartmentOptions() {
  try {
    const response = await requestGraphQL<
      DepartmentOptionsResponse,
      {
        isEnabled: boolean;
        limit: number;
      }
    >(DEPARTMENTS_QUERY, { isEnabled: true, limit: 500 });

    return response.departments;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载院系列表。'));
  }
}

export async function syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(input: {
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

export function resolveCourseScheduleSyncErrorMessage(
  error: unknown,
  context: 'login' | 'sync' = 'sync',
) {
  if (isAcademicSemesterNotFoundError(error)) {
    return '当前学年与学期在本地 academic semester 中不存在，请先补齐学期数据后再同步。';
  }

  return resolveUpstreamErrorMessage(
    error,
    context === 'login' ? '暂时无法登录 upstream，请稍后重试。' : '暂时无法同步课程表。',
  );
}
