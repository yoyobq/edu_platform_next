import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type AcademicTeacherEngagementType =
  | 'ADMINISTRATIVE_TEACHING'
  | 'EXTERNAL_TEACHER'
  | 'FULL_TIME_TEACHER'
  | 'PUBLIC_WELFARE_POST';

export type StaffSemesterProfileSortBy = 'staffId' | 'staffName' | 'updatedAt';

export type SortDirection = 'ASC' | 'DESC';

export type StaffSemesterProfile = {
  remarks: string | null;
  semesterId: number;
  staffId: string;
  staffName: string;
  teacherEngagementType: AcademicTeacherEngagementType | null;
  teachingGroupId: string | null;
  teachingGroupName: string | null;
  updatedAt: string;
  workloadDepartmentId: string | null;
  workloadDepartmentName: string | null;
};

export type StaffSemesterProfileListResponse = {
  current: number;
  list: StaffSemesterProfile[];
  pageSize: number;
  total: number;
};

export type RequestStaffSemesterProfilesInput = {
  keyword?: string;
  limit?: number;
  page?: number;
  semesterId: number;
  sortBy?: StaffSemesterProfileSortBy;
  sortOrder?: SortDirection;
  staffId?: string;
  teacherEngagementType?: AcademicTeacherEngagementType;
  teachingGroupId?: string;
  workloadDepartmentId?: string;
};

type StaffSemesterProfilesResponse = {
  staffSemesterProfiles: StaffSemesterProfileListResponse;
};

const STAFF_SEMESTER_PROFILES_QUERY = `
  query StaffSemesterProfiles(
    $keyword: String
    $limit: Int
    $page: Int
    $semesterId: Int!
    $sortBy: String
    $sortOrder: SortDirection
    $staffId: String
    $teacherEngagementType: AcademicTeacherEngagementType
    $teachingGroupId: String
    $workloadDepartmentId: String
  ) {
    staffSemesterProfiles(
      keyword: $keyword
      limit: $limit
      page: $page
      semesterId: $semesterId
      sortBy: $sortBy
      sortOrder: $sortOrder
      staffId: $staffId
      teacherEngagementType: $teacherEngagementType
      teachingGroupId: $teachingGroupId
      workloadDepartmentId: $workloadDepartmentId
    ) {
      list {
        staffId
        semesterId
        staffName
        teacherEngagementType
        teachingGroupId
        teachingGroupName
        workloadDepartmentId
        workloadDepartmentName
        remarks
        updatedAt
      }
      current
      pageSize
      total
    }
  }
`;

function normalizeStringFilter(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number, max?: number) {
  const normalizedValue = Number.isFinite(value) ? Math.floor(value as number) : fallback;
  const positiveValue = normalizedValue > 0 ? normalizedValue : fallback;

  return max ? Math.min(positiveValue, max) : positiveValue;
}

function normalizeRequestInput(input: RequestStaffSemesterProfilesInput) {
  return {
    keyword: normalizeStringFilter(input.keyword),
    limit: normalizePositiveInteger(input.limit, 10, 100),
    page: normalizePositiveInteger(input.page, 1),
    semesterId: input.semesterId,
    sortBy: input.sortBy ?? 'staffId',
    sortOrder: input.sortOrder ?? 'ASC',
    staffId: normalizeStringFilter(input.staffId),
    teacherEngagementType: input.teacherEngagementType,
    teachingGroupId: normalizeStringFilter(input.teachingGroupId),
    workloadDepartmentId: normalizeStringFilter(input.workloadDepartmentId),
  };
}

function resolveStaffSemesterProfilesErrorMessage(error: unknown, fallback: string) {
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

export async function requestStaffSemesterProfiles(input: RequestStaffSemesterProfilesInput) {
  try {
    const response = await executeGraphQL<
      StaffSemesterProfilesResponse,
      OperationVariables & ReturnType<typeof normalizeRequestInput>
    >(STAFF_SEMESTER_PROFILES_QUERY, normalizeRequestInput(input));

    return response.staffSemesterProfiles;
  } catch (error) {
    throw new Error(resolveStaffSemesterProfilesErrorMessage(error, '暂时无法加载教师学期归属。'));
  }
}
