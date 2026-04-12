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

export type UpdateAdminUserDetailAccountSectionCommand =
  UpdateAdminUserDetailAccountSectionInput & {
    accessGroup: readonly AuthAccessGroup[];
  };

export type UpdateAdminUserDetailAccountSectionResult = {
  account: Partial<Pick<AdminUserDetail['account'], 'identityHint' | 'status' | 'updatedAt'>>;
  isUpdated: boolean;
};

export type UpdateAdminUserDetailAccountSectionPort = {
  updateAccountSection: (
    input: UpdateAdminUserDetailAccountSectionInput,
  ) => Promise<UpdateAdminUserDetailAccountSectionResult>;
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

export type UpdateAdminUserDetailUserInfoSectionPort = {
  updateUserInfoSection: (
    input: UpdateAdminUserDetailUserInfoSectionInput,
  ) => Promise<UpdateAdminUserDetailUserInfoSectionResult>;
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

export type UpdateAdminUserDetailStaffSectionPort = {
  updateStaffSection: (
    input: UpdateAdminUserDetailStaffSectionInput,
  ) => Promise<UpdateAdminUserDetailStaffSectionResult>;
};

export function isAdminUserDetailIdentityHintAllowed(
  accessGroup: readonly AuthAccessGroup[],
  identityHint: AdminUserDetailIdentityHint,
) {
  return identityHint !== 'ADMIN' || accessGroup.includes('ADMIN');
}

export function assertAdminUserDetailIdentityHintAllowed(
  accessGroup: readonly AuthAccessGroup[],
  identityHint: AdminUserDetailIdentityHint,
) {
  if (!isAdminUserDetailIdentityHintAllowed(accessGroup, identityHint)) {
    throw new Error('当前访问组不含 ADMIN，身份提示不能设为 ADMIN。');
  }
}

export async function updateAdminUserDetailAccountSection(
  port: UpdateAdminUserDetailAccountSectionPort,
  input: UpdateAdminUserDetailAccountSectionCommand,
): Promise<UpdateAdminUserDetailAccountSectionResult> {
  assertAdminUserDetailIdentityHintAllowed(input.accessGroup, input.identityHint);

  return port.updateAccountSection({
    accountId: input.accountId,
    identityHint: input.identityHint,
    status: input.status,
  });
}

export async function updateAdminUserDetailUserInfoSection(
  port: UpdateAdminUserDetailUserInfoSectionPort,
  input: UpdateAdminUserDetailUserInfoSectionInput,
): Promise<UpdateAdminUserDetailUserInfoSectionResult> {
  return port.updateUserInfoSection(input);
}

export async function updateAdminUserDetailStaffSection(
  port: UpdateAdminUserDetailStaffSectionPort,
  input: UpdateAdminUserDetailStaffSectionInput,
): Promise<UpdateAdminUserDetailStaffSectionResult> {
  return port.updateStaffSection(input);
}
