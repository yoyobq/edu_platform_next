import { executeGraphQL } from '@/shared/graphql';

import {
  type AdminUserDetail,
  type AdminUserDetailAccountStatus,
  type AdminUserDetailPort,
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

const adminUserDetailPort: AdminUserDetailPort = {
  async getAdminUserDetail(accountId: number): Promise<AdminUserDetail> {
    const response = await executeGraphQL<AdminUserDetailResponse, AdminUserDetailVariables>(
      ADMIN_USER_DETAIL_QUERY,
      { accountId },
    );

    return {
      account: {
        ...response.account,
        recentLoginHistory: response.account.recentLoginHistory ?? [],
      },
      userInfo: {
        ...response.userInfo,
        tags: response.userInfo.tags ?? null,
      },
    };
  },
};

export function requestAdminUserDetail(accountId: number) {
  return getAdminUserDetail(adminUserDetailPort, accountId);
}
