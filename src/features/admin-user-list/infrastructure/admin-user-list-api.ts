import { executeGraphQL } from '@/shared/graphql';

import {
  ADMIN_USER_ACCOUNT_STATUSES,
  type AdminUserAccountStatus,
  type AdminUserEmploymentStatus,
  type AdminUserListItem,
  type AdminUserListPort,
  type AdminUserListQuery,
  type AdminUserListResult,
  type AdminUserSortField,
  type AdminUserSortOrder,
  type AdminUserState,
  getAdminUsers,
} from '../application/get-admin-users';
import {
  updateAdminUserAccountStatus,
  type UpdateAdminUserAccountStatusInput,
  type UpdateAdminUserAccountStatusPort,
  type UpdateAdminUserAccountStatusResult,
} from '../application/update-admin-user-account-status';

type AdminUsersQueryResponse = {
  adminUsers: {
    current: number;
    list: AdminUserListItemDTO[];
    pageSize: number;
    total: number;
  };
};

type AdminUserListItemDTO = {
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
  userInfo: {
    accessGroup: AdminUserListItem['userInfo']['accessGroup'];
    avatarUrl: string | null;
    nickname: string;
    phone: string | null;
    userState: AdminUserState;
  };
};

type AdminUsersQueryVariables = {
  accessGroups?: readonly string[];
  hasStaff?: boolean;
  limit: number;
  page: number;
  query?: string;
  sortBy: AdminUserSortField;
  sortOrder: AdminUserSortOrder;
  status?: AdminUserAccountStatus;
};

type BatchUpdateAccountStatusResponse = {
  batchUpdateAccountStatus: UpdateAdminUserAccountStatusResult;
};

type BatchUpdateAccountStatusVariables = {
  input: {
    accountIds: [number];
    status: AdminUserAccountStatus;
  };
};

const ADMIN_USERS_QUERY = `
  query AdminUsers(
    $accessGroups: [IdentityTypeEnum!]
    $hasStaff: Boolean
    $limit: Int!
    $page: Int!
    $query: String
    $sortBy: String!
    $sortOrder: SortDirection!
    $status: AccountStatus
  ) {
    adminUsers(
      accessGroups: $accessGroups
      hasStaff: $hasStaff
      limit: $limit
      page: $page
      query: $query
      sortBy: $sortBy
      sortOrder: $sortOrder
      status: $status
    ) {
      current
      pageSize
      total
      list {
        account {
          createdAt
          id
          identityHint
          loginEmail
          loginName
          status
        }
        userInfo {
          accessGroup
          avatarUrl
          nickname
          phone
          userState
        }
        staff {
          departmentId
          employmentStatus
          id
          jobTitle
          name
        }
      }
    }
  }
`;

function mapAdminUserListItem(dto: AdminUserListItemDTO): AdminUserListItem {
  return {
    account: dto.account,
    staff: dto.staff,
    userInfo: dto.userInfo,
  };
}

const BATCH_UPDATE_ACCOUNT_STATUS_MUTATION = `
  mutation BatchUpdateAccountStatus($input: BatchUpdateAccountStatusInput!) {
    batchUpdateAccountStatus(input: $input) {
      requestedCount
      updatedCount
      isUpdated
      accounts {
        id
        loginName
        loginEmail
        status
        identityHint
        createdAt
        updatedAt
      }
    }
  }
`;

function toBatchUpdateAccountStatusVariables(
  input: UpdateAdminUserAccountStatusInput,
): BatchUpdateAccountStatusVariables {
  if (!Number.isInteger(input.accountId) || input.accountId <= 0) {
    throw new Error('无效的账户 ID。');
  }

  if (!ADMIN_USER_ACCOUNT_STATUSES.includes(input.status)) {
    throw new Error('无效的账户状态。');
  }

  return {
    input: {
      accountIds: [input.accountId],
      status: input.status,
    },
  };
}

const adminUserListPort: AdminUserListPort = {
  async listAdminUsers(input: AdminUserListQuery): Promise<AdminUserListResult> {
    const response = await executeGraphQL<AdminUsersQueryResponse, AdminUsersQueryVariables>(
      ADMIN_USERS_QUERY,
      {
        accessGroups: input.accessGroups,
        hasStaff: input.hasStaff,
        limit: input.limit ?? 10,
        page: input.page ?? 1,
        query: input.query,
        sortBy: input.sortBy ?? 'createdAt',
        sortOrder: input.sortOrder ?? 'DESC',
        status: input.status,
      },
    );

    return {
      current: response.adminUsers.current,
      list: response.adminUsers.list.map(mapAdminUserListItem),
      pageSize: response.adminUsers.pageSize,
      total: response.adminUsers.total,
    };
  },
};

const updateAdminUserAccountStatusPort: UpdateAdminUserAccountStatusPort = {
  async batchUpdateAccountStatus(
    input: UpdateAdminUserAccountStatusInput,
  ): Promise<UpdateAdminUserAccountStatusResult> {
    const response = await executeGraphQL<
      BatchUpdateAccountStatusResponse,
      BatchUpdateAccountStatusVariables
    >(BATCH_UPDATE_ACCOUNT_STATUS_MUTATION, toBatchUpdateAccountStatusVariables(input));

    return response.batchUpdateAccountStatus;
  },
};

export function requestAdminUsers(input: AdminUserListQuery) {
  return getAdminUsers(adminUserListPort, input);
}

export function requestAdminUserAccountStatusUpdate(input: UpdateAdminUserAccountStatusInput) {
  return updateAdminUserAccountStatus(updateAdminUserAccountStatusPort, input);
}
