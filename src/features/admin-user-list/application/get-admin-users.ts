export {
  ADMIN_USER_ACCOUNT_STATUSES,
  ADMIN_USER_EMPLOYMENT_STATUSES,
  ADMIN_USER_SORT_FIELDS,
  ADMIN_USER_SORT_ORDERS,
  ADMIN_USER_STATES,
  type AdminUserAccountStatus,
  type AdminUserEmploymentStatus,
  type AdminUserListItem,
  type AdminUserListQuery,
  type AdminUserListResult,
  type AdminUserSortField,
  type AdminUserSortOrder,
  type AdminUserState,
  DEFAULT_ADMIN_USER_LIST_QUERY,
  normalizeAdminUserListQuery,
} from '@/entities/admin-user';

import {
  type AdminUserListQuery,
  type AdminUserListResult,
  normalizeAdminUserListQuery,
} from '@/entities/admin-user';

export type AdminUserListPort = {
  listAdminUsers: (input: AdminUserListQuery) => Promise<AdminUserListResult>;
};

export async function getAdminUsers(
  port: AdminUserListPort,
  input: AdminUserListQuery,
): Promise<AdminUserListResult> {
  return port.listAdminUsers(normalizeAdminUserListQuery(input));
}
