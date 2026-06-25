// src/features/admin-user-list/infrastructure/admin-user-list-search-params.ts

import { AUTH_ACCESS_GROUPS, type AuthAccessGroup } from '@/entities/auth-access';

import {
  type AdminUserAccountStatus,
  type AdminUserListQuery,
  type AdminUserSortField,
  type AdminUserSortOrder,
  DEFAULT_ADMIN_USER_LIST_QUERY,
  normalizeAdminUserListQuery,
} from '../application/get-admin-users';

export type AdminUserHasStaffFilterValue = 'true' | 'false';

const DEFAULT_QUERY = DEFAULT_ADMIN_USER_LIST_QUERY;

function parseHasStaffSearchParam(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function parseAccessGroupsSearchParams(searchParams: URLSearchParams): readonly AuthAccessGroup[] {
  return searchParams
    .getAll('accessGroup')
    .filter((value): value is AuthAccessGroup =>
      AUTH_ACCESS_GROUPS.includes(value as AuthAccessGroup),
    );
}

export function normalizeAdminUserHasStaffFilterValue(
  value: AdminUserHasStaffFilterValue,
): boolean {
  return value === 'true';
}

export function buildAdminUserListSearchParams(criteria: AdminUserListQuery) {
  const normalizedCriteria = normalizeAdminUserListQuery({
    ...DEFAULT_QUERY,
    ...criteria,
  });
  const nextSearchParams = new URLSearchParams();

  if (normalizedCriteria.query) {
    nextSearchParams.set('query', normalizedCriteria.query);
  }

  if (normalizedCriteria.status) {
    nextSearchParams.set('status', normalizedCriteria.status);
  }

  for (const accessGroup of normalizedCriteria.accessGroups ?? []) {
    nextSearchParams.append('accessGroup', accessGroup);
  }

  nextSearchParams.set('hasStaff', normalizedCriteria.hasStaff === false ? 'false' : 'true');
  nextSearchParams.set('limit', String(normalizedCriteria.limit ?? DEFAULT_QUERY.limit));
  nextSearchParams.set('page', String(normalizedCriteria.page ?? DEFAULT_QUERY.page));
  nextSearchParams.set('sortBy', normalizedCriteria.sortBy ?? DEFAULT_QUERY.sortBy);
  nextSearchParams.set('sortOrder', normalizedCriteria.sortOrder ?? DEFAULT_QUERY.sortOrder);

  return nextSearchParams;
}

export function parseAdminUserListSearchParams(searchParams: URLSearchParams): AdminUserListQuery {
  return normalizeAdminUserListQuery({
    ...DEFAULT_QUERY,
    accessGroups: parseAccessGroupsSearchParams(searchParams),
    hasStaff: parseHasStaffSearchParam(searchParams.get('hasStaff')) ?? DEFAULT_QUERY.hasStaff,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : DEFAULT_QUERY.limit,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : DEFAULT_QUERY.page,
    query: searchParams.get('query') ?? undefined,
    sortBy: (searchParams.get('sortBy') as AdminUserSortField | null) ?? DEFAULT_QUERY.sortBy,
    sortOrder:
      (searchParams.get('sortOrder') as AdminUserSortOrder | null) ?? DEFAULT_QUERY.sortOrder,
    status: searchParams.get('status') as AdminUserAccountStatus | undefined,
  });
}
