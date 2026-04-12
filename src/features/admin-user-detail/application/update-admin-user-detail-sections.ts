import type { AuthAccessGroup } from '@/shared/auth-access';

import type {
  AdminUserDetail,
  AdminUserDetailAccountStatus,
  AdminUserDetailGender,
  AdminUserDetailStaffEmploymentStatus,
  AdminUserDetailUserState,
} from './get-admin-user-detail';

export type UpdateAdminUserDetailAccountSectionInput = {
  accountId: number;
  identityHint: AuthAccessGroup;
  status: AdminUserDetailAccountStatus;
};

export type UpdateAdminUserDetailAccountSectionResult = {
  account: Partial<Pick<AdminUserDetail['account'], 'identityHint' | 'status' | 'updatedAt'>>;
  isUpdated: boolean;
};

export type UpdateAdminUserDetailUserInfoSectionInput = {
  accountId: number;
  address: string | null;
  birthDate: string | null;
  email: string | null;
  gender: AdminUserDetailGender;
  geographic: string | null;
  nickname: string;
  phone: string | null;
  signature: string | null;
  tags: readonly string[];
  userState: AdminUserDetailUserState;
};

export type UpdateAdminUserDetailUserInfoSectionResult = {
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
