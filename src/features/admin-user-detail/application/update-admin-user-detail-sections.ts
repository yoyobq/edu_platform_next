import type { AuthAccessGroup } from '@/shared/auth-access';

import type {
  AdminUserDetail,
  AdminUserDetailAccountStatus,
  AdminUserDetailGender,
  AdminUserDetailIdentityHint,
  AdminUserDetailStaffEmploymentStatus,
  AdminUserDetailUserState,
} from './get-admin-user-detail';

export type UpdateAdminUserDetailAccountSectionInput = {
  accountId: number;
  identityHint: AdminUserDetailIdentityHint;
  status: AdminUserDetailAccountStatus;
};

export type UpdateAdminUserDetailAccountSectionResult = {
  account: Partial<Pick<AdminUserDetail['account'], 'identityHint' | 'status' | 'updatedAt'>>;
  isUpdated: boolean;
};

export type UpdateAdminUserDetailUserInfoSectionInput = {
  accessGroup?: readonly AuthAccessGroup[];
  accountId: number;
  address: string | null;
  birthDate: string | null;
  email: string | null;
  gender: AdminUserDetailGender;
  geographic: {
    city?: string;
    province?: string;
  } | null;
  nickname: string;
  phone: string | null;
  signature: string | null;
  tags: readonly string[];
  userState: AdminUserDetailUserState;
};

export type UpdateAdminUserDetailUserInfoSectionResult = {
  account: Partial<Pick<AdminUserDetail['account'], 'identityHint'>>;
  isUpdated: boolean;
  userInfo: AdminUserDetail['userInfo'];
};

export type UpdateAdminUserDetailStaffSectionInput = {
  accountId: number;
  departmentId: string | null;
  employmentStatus: AdminUserDetailStaffEmploymentStatus;
  jobTitle: string | null;
  name: string;
  remark: string | null;
};

export type UpdateAdminUserDetailStaffSectionResult = {
  isUpdated: boolean;
  staff: AdminUserDetail['staff'];
};
