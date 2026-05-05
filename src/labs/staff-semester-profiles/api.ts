import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type AcademicTeacherEngagementType =
  | 'ADMINISTRATIVE_TEACHING'
  | 'EXTERNAL_TEACHER'
  | 'FULL_TIME_TEACHER'
  | 'PUBLIC_WELFARE_POST';

export type StaffSemesterProfileSortBy = 'staffId' | 'staffName' | 'updatedAt';

export type SortDirection = 'ASC' | 'DESC';

export type StaffSemesterProfileBackfillAction =
  | 'already_exists'
  | 'blocked'
  | 'created'
  | 'would_create';

export type StaffSemesterProfileBackfillBlockingReason =
  | 'teaching_group_not_found'
  | 'teaching_group_workload_department_mismatch'
  | null;

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

export type RequestStaffSemesterProfileOptionRecordsInput = {
  semesterId: number;
};

export type UpdateStaffSemesterProfileInput = {
  semesterId: number;
  staffId: string;
  teacherEngagementType?: AcademicTeacherEngagementType;
  teachingGroupId?: string | null;
  workloadDepartmentId?: string | null;
};

export type StaffSemesterProfileDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type BackfillStaffSemesterProfilesFromCourseSchedulesInput = {
  dryRun?: boolean;
  semesterId: number;
  workloadDepartmentId: string;
};

export type BackfillStaffSemesterProfilesFromCourseSchedulesItem = {
  action: StaffSemesterProfileBackfillAction;
  blockingReason: StaffSemesterProfileBackfillBlockingReason;
  inheritedFromSemesterId: number | null;
  staffId: string;
  staffName: string;
  teacherEngagementType: AcademicTeacherEngagementType;
  teachingGroupId: string | null;
};

export type BackfillStaffSemesterProfilesFromCourseSchedulesResult = {
  alreadyExistingCount: number;
  blockingCount: number;
  candidateCount: number;
  creatableCount: number;
  createdCount: number;
  dryRun: boolean;
  items: BackfillStaffSemesterProfilesFromCourseSchedulesItem[];
  semesterId: number;
  workloadDepartmentId: string;
};

type StaffSemesterProfilesResponse = {
  staffSemesterProfiles: StaffSemesterProfileListResponse;
};

type UpdateStaffSemesterProfileResponse = {
  updateStaffSemesterProfile: StaffSemesterProfile & {
    createdAt: string;
  };
};

type StaffSemesterProfileDepartmentsResponse = {
  departments: StaffSemesterProfileDepartmentOption[];
};

type BackfillStaffSemesterProfilesFromCourseSchedulesResponse = {
  backfillStaffSemesterProfilesFromCourseSchedules: BackfillStaffSemesterProfilesFromCourseSchedulesResult;
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

const STAFF_SEMESTER_PROFILE_DEPARTMENTS_QUERY = `
  query StaffSemesterProfileDepartments($isEnabled: Boolean, $limit: Int) {
    departments(isEnabled: $isEnabled, limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

const UPDATE_STAFF_SEMESTER_PROFILE_MUTATION = `
  mutation UpdateStaffSemesterProfile($input: UpdateStaffSemesterProfileInput!) {
    updateStaffSemesterProfile(input: $input) {
      staffId
      semesterId
      staffName
      teacherEngagementType
      teachingGroupId
      teachingGroupName
      workloadDepartmentId
      workloadDepartmentName
      remarks
      createdAt
      updatedAt
    }
  }
`;

const BACKFILL_STAFF_SEMESTER_PROFILES_FROM_COURSE_SCHEDULES_MUTATION = `
  mutation BackfillStaffSemesterProfilesFromCourseSchedules(
    $input: BackfillStaffSemesterProfilesFromCourseSchedulesInput!
  ) {
    backfillStaffSemesterProfilesFromCourseSchedules(input: $input) {
      dryRun
      semesterId
      workloadDepartmentId
      candidateCount
      creatableCount
      createdCount
      alreadyExistingCount
      blockingCount
      items {
        staffId
        staffName
        action
        inheritedFromSemesterId
        teacherEngagementType
        teachingGroupId
        blockingReason
      }
    }
  }
`;

function normalizeStringFilter(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeNullableStringInput(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  return normalizeStringFilter(value);
}

function normalizePositiveInteger(value: number | undefined, fallback: number, max?: number) {
  const normalizedValue = Number.isFinite(value) ? Math.floor(value as number) : fallback;
  const positiveValue = normalizedValue > 0 ? normalizedValue : fallback;

  return max ? Math.min(positiveValue, max) : positiveValue;
}

function normalizeUpdateInput(input: UpdateStaffSemesterProfileInput) {
  return {
    semesterId: input.semesterId,
    staffId: input.staffId.trim(),
    teacherEngagementType: input.teacherEngagementType,
    teachingGroupId:
      input.teachingGroupId === undefined
        ? undefined
        : normalizeNullableStringInput(input.teachingGroupId),
    workloadDepartmentId:
      input.workloadDepartmentId === undefined
        ? undefined
        : normalizeNullableStringInput(input.workloadDepartmentId),
  };
}

function normalizeBackfillInput(input: BackfillStaffSemesterProfilesFromCourseSchedulesInput) {
  return {
    dryRun: input.dryRun ?? false,
    semesterId: input.semesterId,
    workloadDepartmentId: input.workloadDepartmentId.trim(),
  };
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

export async function requestStaffSemesterProfileDepartments() {
  try {
    const response = await executeGraphQL<
      StaffSemesterProfileDepartmentsResponse,
      {
        isEnabled: boolean;
        limit: number;
      }
    >(STAFF_SEMESTER_PROFILE_DEPARTMENTS_QUERY, { isEnabled: true, limit: 500 });

    return response.departments;
  } catch (error) {
    throw new Error(resolveStaffSemesterProfilesErrorMessage(error, '暂时无法加载系部列表。'));
  }
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

export async function requestStaffSemesterProfileOptionRecords(
  input: RequestStaffSemesterProfileOptionRecordsInput,
) {
  const records: StaffSemesterProfile[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (records.length < total) {
    const response = await requestStaffSemesterProfiles({
      limit: 100,
      page,
      semesterId: input.semesterId,
      sortBy: 'staffId',
      sortOrder: 'ASC',
    });

    records.push(...response.list);
    total = response.total;

    if (response.list.length === 0) {
      break;
    }

    page += 1;
  }

  return records;
}

export async function updateStaffSemesterProfile(input: UpdateStaffSemesterProfileInput) {
  try {
    const response = await executeGraphQL<
      UpdateStaffSemesterProfileResponse,
      {
        input: ReturnType<typeof normalizeUpdateInput>;
      }
    >(UPDATE_STAFF_SEMESTER_PROFILE_MUTATION, { input: normalizeUpdateInput(input) });

    return response.updateStaffSemesterProfile;
  } catch (error) {
    throw new Error(resolveStaffSemesterProfilesErrorMessage(error, '暂时无法修改教师学期归属。'));
  }
}

export async function backfillStaffSemesterProfilesFromCourseSchedules(
  input: BackfillStaffSemesterProfilesFromCourseSchedulesInput,
) {
  try {
    const response = await executeGraphQL<
      BackfillStaffSemesterProfilesFromCourseSchedulesResponse,
      {
        input: ReturnType<typeof normalizeBackfillInput>;
      }
    >(BACKFILL_STAFF_SEMESTER_PROFILES_FROM_COURSE_SCHEDULES_MUTATION, {
      input: normalizeBackfillInput(input),
    });

    return response.backfillStaffSemesterProfilesFromCourseSchedules;
  } catch (error) {
    throw new Error(
      resolveStaffSemesterProfilesErrorMessage(error, '暂时无法从课程表补齐教师学期归属。'),
    );
  }
}
