import { executeGraphQL } from '@/shared/graphql';

import {
  type AdminUserDetail,
  type AdminUserDetailAccountStatus,
  type AdminUserDetailPort,
  type AdminUserDetailStaffEmploymentStatus,
  type AdminUserDetailUserState,
  getAdminUserDetail,
} from '../application/get-admin-user-detail';

type AdminUserDetailResponse = {
  account: {
    createdAt: string;
    id: number;
    identityHint: string | null;
    loginEmail: string | null;
    loginName: string | null;
    recentLoginHistory:
      | {
          audience: string | null;
          ip: string;
          timestamp: string;
        }[]
      | null;
    status: AdminUserDetailAccountStatus;
    updatedAt: string;
  };
  userInfo: {
    accessGroup: AdminUserDetail['userInfo']['accessGroup'];
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
    tags: string[] | null;
    unreadCount: number;
    updatedAt: string;
    userState: AdminUserDetailUserState;
  };
};

type AdminUserDetailStaffResponse = {
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
};

type AdminUserDetailVariables = {
  accountId: number;
};

const ADMIN_USER_DETAIL_QUERY = `
  query AdminUserDetail($accountId: Int!) {
    account(id: $accountId) {
      createdAt
      id
      identityHint
      loginEmail
      loginName
      recentLoginHistory {
        audience
        ip
        timestamp
      }
      status
      updatedAt
    }
    userInfo(accountId: $accountId) {
      accessGroup
      address
      avatarUrl
      birthDate
      createdAt
      email
      gender
      geographic
      id
      nickname
      notifyCount
      phone
      signature
      tags
      unreadCount
      updatedAt
      userState
    }
  }
`;

const ADMIN_USER_DETAIL_STAFF_QUERY = `
  query AdminUserDetailStaff($accountId: Int!) {
    staff(accountId: $accountId) {
      accountId
      createdAt
      departmentId
      employmentStatus
      id
      jobTitle
      name
      remark
      updatedAt
    }
  }
`;

const adminUserDetailPort: AdminUserDetailPort = {
  async getAdminUserDetail(accountId: number): Promise<AdminUserDetail> {
    const [detailResponse, staffResponse] = await Promise.all([
      executeGraphQL<AdminUserDetailResponse, AdminUserDetailVariables>(ADMIN_USER_DETAIL_QUERY, {
        accountId,
      }),
      executeGraphQL<AdminUserDetailStaffResponse, AdminUserDetailVariables>(
        ADMIN_USER_DETAIL_STAFF_QUERY,
        { accountId },
      ),
    ]);

    return {
      account: {
        ...detailResponse.account,
        recentLoginHistory: detailResponse.account.recentLoginHistory ?? [],
      },
      staff: staffResponse.staff,
      userInfo: {
        ...detailResponse.userInfo,
        tags: detailResponse.userInfo.tags ?? null,
      },
    };
  },
};

export function requestAdminUserDetail(accountId: number) {
  return getAdminUserDetail(adminUserDetailPort, accountId);
}
