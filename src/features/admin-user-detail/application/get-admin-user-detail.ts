import { type AuthAccessGroup } from '@/shared/auth-access';

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
export const ADMIN_USER_DETAIL_GENDERS = ['FEMALE', 'MALE', 'SECRET'] as const;
export const ADMIN_USER_DETAIL_IDENTITY_HINTS = ['ADMIN', 'STAFF', 'STUDENT'] as const;
export const ADMIN_USER_DETAIL_STAFF_SLOT_CODES = [
  'ACADEMIC_OFFICER',
  'CLASS_ADVISER',
  'COUNSELOR',
  'STUDENT_AFFAIRS_OFFICER',
  'TEACHING_GROUP_LEADER',
] as const;
export const ADMIN_USER_DETAIL_ASSIGNABLE_STAFF_SLOT_CODES = [
  'ACADEMIC_OFFICER',
  'STUDENT_AFFAIRS_OFFICER',
] as const;
export const ADMIN_USER_DETAIL_IDENTITY_POST_STATUSES = ['ACTIVE', 'ENDED', 'INACTIVE'] as const;

export type AdminUserDetailAccountStatus = (typeof ADMIN_USER_DETAIL_ACCOUNT_STATUSES)[number];
export type AdminUserDetailUserState = (typeof ADMIN_USER_DETAIL_USER_STATES)[number];
export type AdminUserDetailStaffEmploymentStatus =
  (typeof ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUSES)[number];
export type AdminUserDetailGender = (typeof ADMIN_USER_DETAIL_GENDERS)[number];
export type AdminUserDetailIdentityHint = (typeof ADMIN_USER_DETAIL_IDENTITY_HINTS)[number];
export type AdminUserDetailStaffSlotCode = (typeof ADMIN_USER_DETAIL_STAFF_SLOT_CODES)[number];
export type AdminUserDetailAssignableStaffSlotCode =
  (typeof ADMIN_USER_DETAIL_ASSIGNABLE_STAFF_SLOT_CODES)[number];
export type AdminUserDetailIdentityPostStatus =
  (typeof ADMIN_USER_DETAIL_IDENTITY_POST_STATUSES)[number];

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

export const ADMIN_USER_DETAIL_GENDER_LABELS: Record<AdminUserDetailGender, string> = {
  FEMALE: '女',
  MALE: '男',
  SECRET: '保密',
};

export const ADMIN_USER_DETAIL_STAFF_SLOT_LABELS: Record<AdminUserDetailStaffSlotCode, string> = {
  ACADEMIC_OFFICER: '教务员',
  CLASS_ADVISER: '班主任',
  COUNSELOR: '辅导员',
  STUDENT_AFFAIRS_OFFICER: '学工员',
  TEACHING_GROUP_LEADER: '教学组长',
};

export const ADMIN_USER_DETAIL_IDENTITY_POST_STATUS_LABELS: Record<
  AdminUserDetailIdentityPostStatus,
  string
> = {
  ACTIVE: '有效',
  ENDED: '已结束',
  INACTIVE: '未激活',
};

export type AdminUserDetail = {
  account: {
    createdAt: string;
    id: number;
    identityHint: AdminUserDetailIdentityHint | null;
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
  staffSlotPosts: readonly {
    endAt: string | null;
    id: number;
    isTemporary: boolean;
    remarks: string | null;
    scope: {
      classId: string | null;
      departmentId: string | null;
      teachingGroupId: string | null;
    };
    slotCode: AdminUserDetailStaffSlotCode;
    staffId: string;
    startAt: string | null;
    status: AdminUserDetailIdentityPostStatus;
  }[];
  userInfo: {
    accessGroup: readonly AuthAccessGroup[];
    address: string | null;
    avatarUrl: string | null;
    birthDate: string | null;
    createdAt: string;
    email: string | null;
    gender: AdminUserDetailGender;
    geographic: {
      city: string | null;
      province: string | null;
    } | null;
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
