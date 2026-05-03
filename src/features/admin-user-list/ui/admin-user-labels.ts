import type {
  AdminUserAccountStatus,
  AdminUserEmploymentStatus,
} from '../application/get-admin-users';

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
