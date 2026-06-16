import type { OperationVariables } from '@apollo/client';

import { VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT } from '@/entities/academic-semester';
import {
  executeUpstreamSessionGraphQL,
  isExpiredUpstreamSessionError,
  readUpstreamGraphQLErrorDetail,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
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
  scheduleId: number | null;
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
  dryRun?: boolean;
  expiresAt?: string | null;
  failedCount: number;
  failures: CourseScheduleSyncFailure[];
  fetchedCount: number;
  importedCount?: number;
  items: CourseScheduleSyncItem[];
  previewedCount?: number;
  semesterId: number;
  upstreamSessionToken?: string | null;
  updatedCount: number;
};

export type CourseScheduleSyncInput = {
  departmentId: string;
  reviewStatus?: DepartmentCurriculumPlanReviewStatus;
  schoolYear: string;
  semester: string;
  teacherId?: string;
  upstreamSessionToken: string;
};

export type CourseScheduleSyncSemesterOption = {
  id: number;
  isCurrent: boolean;
  schoolYear: number;
  sortOrder: number;
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

type AcademicSemestersResponse = {
  academicSemesters: Array<{
    id: number;
    isCurrent: boolean;
    schoolYear: number;
    sortOrder: number;
    termNumber: number;
  }>;
};

type SyncCourseSchedulesResponse = {
  syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans: CourseScheduleSyncResult;
};

type DryRunSyncCourseSchedulesResponse = {
  dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans: CourseScheduleSyncResult;
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

const DRY_RUN_SYNC_COURSE_SCHEDULES_MUTATION = `
  mutation DryRunSyncCourseSchedules(
    $input: SyncCourseSchedulesFromUpstreamDepartmentCurriculumPlansInput!
  ) {
    dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(input: $input) {
      dryRun
      semesterId
      fetchedCount
      previewedCount
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
  query CourseScheduleSyncDepartments($limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

const ACADEMIC_SEMESTERS_QUERY = `
  query CourseScheduleSyncAcademicSemesters($isVisible: Boolean, $limit: Int) {
    academicSemesters(isVisible: $isVisible, limit: $limit) {
      id
      isCurrent
      schoolYear
      sortOrder
      termNumber
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function normalizeCourseScheduleSyncInput(input: CourseScheduleSyncInput) {
  return {
    departmentId: normalizeRequiredTextValue(input.departmentId, { label: '院系' }),
    reviewStatus: input.reviewStatus,
    schoolYear: normalizeRequiredTextValue(String(input.schoolYear || ''), { label: '学年' }),
    semester: normalizeRequiredTextValue(String(input.semester || ''), { label: '学期' }),
    teacherId: normalizeOptionalTextValue(input.teacherId, 'to_undefined'),
    upstreamSessionToken: input.upstreamSessionToken,
  };
}

export async function fetchCourseScheduleSyncSemesterOptions() {
  try {
    const response = await requestGraphQL<
      AcademicSemestersResponse,
      typeof VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT
    >(ACADEMIC_SEMESTERS_QUERY, VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT);

    return response.academicSemesters.map((semester) => ({
      id: semester.id,
      isCurrent: semester.isCurrent,
      schoolYear: semester.schoolYear,
      sortOrder: semester.sortOrder,
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
        limit: number;
      }
    >(DEPARTMENTS_QUERY, { limit: 500 });

    return response.departments;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载院系列表。'));
  }
}

export async function dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(
  input: CourseScheduleSyncInput,
) {
  const response = await executeUpstreamSessionGraphQL<
    DryRunSyncCourseSchedulesResponse,
    {
      input: ReturnType<typeof normalizeCourseScheduleSyncInput>;
    }
  >(DRY_RUN_SYNC_COURSE_SCHEDULES_MUTATION, {
    input: normalizeCourseScheduleSyncInput(input),
  });

  return response.dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans;
}

export async function syncCourseSchedulesFromUpstreamDepartmentCurriculumPlans(
  input: CourseScheduleSyncInput,
) {
  const response = await executeUpstreamSessionGraphQL<
    SyncCourseSchedulesResponse,
    {
      input: ReturnType<typeof normalizeCourseScheduleSyncInput>;
    }
  >(SYNC_COURSE_SCHEDULES_MUTATION, {
    input: normalizeCourseScheduleSyncInput(input),
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
