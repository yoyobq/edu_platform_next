// src/features/staff-semester-profiles/application/query-state.ts
import type {
  AcademicTeacherEngagementType,
  SortDirection,
  StaffSemesterProfileSortBy,
} from '../infrastructure/staff-semester-profiles-api';

export type StaffSemesterProfilesViewerRole = 'academicOfficer' | 'admin';

export type StaffSemesterProfilesFilterState = {
  staffId: string;
  teacherEngagementType?: AcademicTeacherEngagementType;
  teachingGroupId: string;
  workloadDepartmentId: string;
};

export type StaffSemesterProfilesQueryState = StaffSemesterProfilesFilterState & {
  limit: number;
  page: number;
  sortBy: StaffSemesterProfileSortBy;
  sortOrder: SortDirection;
};

export const DEFAULT_FILTER_STATE: StaffSemesterProfilesFilterState = {
  staffId: '',
  teacherEngagementType: undefined,
  teachingGroupId: '',
  workloadDepartmentId: '',
};

export const DEFAULT_QUERY_STATE: StaffSemesterProfilesQueryState = {
  ...DEFAULT_FILTER_STATE,
  limit: 50,
  page: 1,
  sortBy: 'staffId',
  sortOrder: 'ASC',
};

export function toSorterOrder(sortOrder: SortDirection): 'ascend' | 'descend' {
  return sortOrder === 'ASC' ? 'ascend' : 'descend';
}

export function fromSorterOrder(value: 'ascend' | 'descend' | null | undefined): SortDirection {
  return value === 'descend' ? 'DESC' : 'ASC';
}

export function isProfileSortField(value: string | undefined): value is StaffSemesterProfileSortBy {
  return value === 'staffId' || value === 'staffName' || value === 'updatedAt';
}

export function normalizeTextFilter(value: string) {
  return value.trim();
}

export function scopeFilterStateToWorkloadDepartment<
  TState extends StaffSemesterProfilesFilterState,
>(state: TState, workloadDepartmentId: string) {
  if (!workloadDepartmentId) {
    return state;
  }

  return {
    ...state,
    workloadDepartmentId,
  } as TState;
}
