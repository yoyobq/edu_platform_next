import type { AuthAccessGroup } from '@/shared/auth-access';

export const ADMIN_USER_ACCOUNT_STATUSES = [
  'ACTIVE',
  'BANNED',
  'DELETED',
  'INACTIVE',
  'PENDING',
  'SUSPENDED',
] as const;
export const ADMIN_USER_EMPLOYMENT_STATUSES = ['ACTIVE', 'LEFT', 'SUSPENDED'] as const;
export const ADMIN_USER_SORT_FIELDS = ['createdAt', 'id', 'loginName'] as const;
export const ADMIN_USER_SORT_ORDERS = ['ASC', 'DESC'] as const;
export const ADMIN_USER_STATES = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'] as const;

export type AdminUserAccountStatus = (typeof ADMIN_USER_ACCOUNT_STATUSES)[number];
export type AdminUserEmploymentStatus = (typeof ADMIN_USER_EMPLOYMENT_STATUSES)[number];
export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];
export type AdminUserSortOrder = (typeof ADMIN_USER_SORT_ORDERS)[number];
export type AdminUserState = (typeof ADMIN_USER_STATES)[number];

export const ADMIN_USER_ACCOUNT_STATUS_LABELS: Record<AdminUserAccountStatus, string> = {
  ACTIVE: '正常',
  BANNED: '已封禁',
  DELETED: '已删除',
  INACTIVE: '已停用',
  PENDING: '待激活',
  SUSPENDED: '已暂停',
};
export const ADMIN_USER_EMPLOYMENT_STATUS_LABELS: Record<AdminUserEmploymentStatus, string> = {
  ACTIVE: '在职',
  LEFT: '已离职',
  SUSPENDED: '已停用',
};

export type AdminUserListItem = {
  account: {
    createdAt: string;
    id: number;
    identityHint: string | null;
    loginEmail: string | null;
    loginName: string | null;
    status: AdminUserAccountStatus;
  };
  staff: {
    departmentId: string | null;
    employmentStatus: AdminUserEmploymentStatus;
    id: string;
    jobTitle: string | null;
    name: string;
  } | null;
  slotGroups: readonly {
    code: string;
    name: string;
  }[];
  userInfo: {
    accessGroup: readonly AuthAccessGroup[];
    avatarUrl: string | null;
    nickname: string;
    phone: string | null;
    userState: AdminUserState;
  };
};

export type AdminUserListResult = {
  current: number;
  list: readonly AdminUserListItem[];
  pageSize: number;
  total: number;
};

export type AdminUserListQuery = {
  accessGroups?: readonly AuthAccessGroup[];
  hasStaff?: boolean;
  limit?: number;
  page?: number;
  query?: string;
  sortBy?: AdminUserSortField;
  sortOrder?: AdminUserSortOrder;
  status?: AdminUserAccountStatus;
};

export type AdminUserListPort = {
  listAdminUsers: (input: AdminUserListQuery) => Promise<AdminUserListResult>;
};

export const DEFAULT_ADMIN_USER_LIST_QUERY: Required<
  Pick<AdminUserListQuery, 'hasStaff' | 'limit' | 'page' | 'sortBy' | 'sortOrder'>
> = {
  hasStaff: true,
  limit: 10,
  page: 1,
  sortBy: 'id',
  sortOrder: 'DESC',
};

function normalizeQuery(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeAccessGroups(value: readonly AuthAccessGroup[] | undefined) {
  if (!value || value.length === 0) {
    return undefined;
  }

  return Array.from(new Set(value));
}

export function normalizeAdminUserListQuery(input: AdminUserListQuery): AdminUserListQuery {
  return {
    accessGroups: normalizeAccessGroups(input.accessGroups),
    hasStaff: typeof input.hasStaff === 'boolean' ? input.hasStaff : undefined,
    limit:
      typeof input.limit === 'number' && Number.isFinite(input.limit)
        ? Math.min(Math.max(Math.trunc(input.limit), 1), 100)
        : DEFAULT_ADMIN_USER_LIST_QUERY.limit,
    page:
      typeof input.page === 'number' && Number.isFinite(input.page)
        ? Math.max(Math.trunc(input.page), 1)
        : DEFAULT_ADMIN_USER_LIST_QUERY.page,
    query: normalizeQuery(input.query),
    sortBy: ADMIN_USER_SORT_FIELDS.includes(input.sortBy as AdminUserSortField)
      ? input.sortBy
      : DEFAULT_ADMIN_USER_LIST_QUERY.sortBy,
    sortOrder: ADMIN_USER_SORT_ORDERS.includes(input.sortOrder as AdminUserSortOrder)
      ? input.sortOrder
      : DEFAULT_ADMIN_USER_LIST_QUERY.sortOrder,
    status: ADMIN_USER_ACCOUNT_STATUSES.includes(input.status as AdminUserAccountStatus)
      ? input.status
      : undefined,
  };
}

export async function getAdminUsers(
  port: AdminUserListPort,
  input: AdminUserListQuery,
): Promise<AdminUserListResult> {
  return port.listAdminUsers(normalizeAdminUserListQuery(input));
}
