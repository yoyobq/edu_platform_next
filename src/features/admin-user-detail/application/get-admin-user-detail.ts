import type { AuthAccessGroup } from '@/shared/auth-access';

export const ADMIN_USER_DETAIL_ACCOUNT_STATUSES = [
  'ACTIVE',
  'BANNED',
  'DELETED',
  'INACTIVE',
  'PENDING',
  'SUSPENDED',
] as const;
export const ADMIN_USER_DETAIL_USER_STATES = [
  'ACTIVE',
  'INACTIVE',
  'PENDING',
  'SUSPENDED',
] as const;
export const ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUSES = ['ACTIVE', 'LEFT', 'SUSPENDED'] as const;

export type AdminUserDetailAccountStatus = (typeof ADMIN_USER_DETAIL_ACCOUNT_STATUSES)[number];
export type AdminUserDetailUserState = (typeof ADMIN_USER_DETAIL_USER_STATES)[number];
export type AdminUserDetailStaffEmploymentStatus =
  (typeof ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUSES)[number];

export const ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS: Record<AdminUserDetailAccountStatus, string> =
  {
    ACTIVE: '正常',
    BANNED: '已封禁',
    DELETED: '已删除',
    INACTIVE: '已停用',
    PENDING: '待激活',
    SUSPENDED: '已暂停',
  };

export const ADMIN_USER_DETAIL_USER_STATE_LABELS: Record<AdminUserDetailUserState, string> = {
  ACTIVE: '正常',
  INACTIVE: '未激活',
  PENDING: '待完善',
  SUSPENDED: '已暂停',
};

export const ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS: Record<
  AdminUserDetailStaffEmploymentStatus,
  string
> = {
  ACTIVE: '在职',
  LEFT: '已离职',
  SUSPENDED: '已停用',
};

export type AdminUserDetail = {
  account: {
    createdAt: string;
    id: number;
    identityHint: string | null;
    loginEmail: string | null;
    loginName: string | null;
    recentLoginHistory: readonly {
      audience: string | null;
      ip: string;
      timestamp: string;
    }[];
    status: AdminUserDetailAccountStatus;
    updatedAt: string;
  };
  staff: {
    accountId: number;
    createdAt: string;
    departmentId: string | null;
    employmentStatus: AdminUserDetailStaffEmploymentStatus;
    id: string;
    jobTitle: string | null;
    name: string;
    remark: string | null;
    updatedAt: string;
  };
  userInfo: {
    accessGroup: readonly AuthAccessGroup[];
    address: string | null;
    avatarUrl: string | null;
    birthDate: string | null;
    createdAt: string;
    email: string | null;
    gender: string;
    geographic: string | null;
    id: string;
    nickname: string;
    notifyCount: number;
    phone: string | null;
    signature: string | null;
    tags: readonly string[] | null;
    unreadCount: number;
    updatedAt: string;
    userState: AdminUserDetailUserState;
  };
};

export type AdminUserDetailPort = {
  getAdminUserDetail: (accountId: number) => Promise<AdminUserDetail>;
};

export function normalizeAdminUserDetailAccountId(accountId: number) {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error('无效的账户 ID。');
  }

  return accountId;
}

export async function getAdminUserDetail(
  port: AdminUserDetailPort,
  accountId: number,
): Promise<AdminUserDetail> {
  return port.getAdminUserDetail(normalizeAdminUserDetailAccountId(accountId));
}
