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
import {
  updateAdminUserStaffEmploymentStatus,
  type UpdateAdminUserStaffEmploymentStatusInput,
  type UpdateAdminUserStaffEmploymentStatusPort,
  type UpdateAdminUserStaffEmploymentStatusResult,
} from '../application/update-admin-user-staff-employment-status';

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
    accountIds: number[];
    status: AdminUserAccountStatus;
  };
};

type BatchUpdateStaffEmploymentStatusResponse = {
  batchUpdateStaffEmploymentStatus: UpdateAdminUserStaffEmploymentStatusResult;
};

type BatchUpdateStaffEmploymentStatusVariables = {
  input: {
    accountIds: number[];
    employmentStatus: AdminUserEmploymentStatus;
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

const BATCH_UPDATE_STAFF_EMPLOYMENT_STATUS_MUTATION = `
  mutation BatchUpdateStaffEmploymentStatus($input: BatchUpdateStaffEmploymentStatusInput!) {
    batchUpdateStaffEmploymentStatus(input: $input) {
      requestedCount
      updatedCount
      isUpdated
      staffs {
        accountId
        createdAt
        departmentId
        employmentStatus
        id
        jobTitle
        name
        updatedAt
      }
    }
  }
`;

function toBatchUpdateAccountStatusVariables(
  input: UpdateAdminUserAccountStatusInput,
): BatchUpdateAccountStatusVariables {
  const accountIds = Array.from(new Set(input.accountIds));

  if (
    accountIds.length === 0 ||
    accountIds.some((accountId) => !Number.isInteger(accountId) || accountId <= 0)
  ) {
    throw new Error('无效的账户 ID 列表。');
  }

  if (!ADMIN_USER_ACCOUNT_STATUSES.includes(input.status)) {
    throw new Error('无效的账户状态。');
  }

  return {
    input: {
      accountIds,
      status: input.status,
    },
  };
}

function toBatchUpdateStaffEmploymentStatusVariables(
  input: UpdateAdminUserStaffEmploymentStatusInput,
): BatchUpdateStaffEmploymentStatusVariables {
  const accountIds = Array.from(new Set(input.accountIds));

  if (
    accountIds.length === 0 ||
    accountIds.some((accountId) => !Number.isInteger(accountId) || accountId <= 0)
  ) {
    throw new Error('无效的账户 ID 列表。');
  }

  return {
    input: {
      accountIds,
      employmentStatus: input.employmentStatus,
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

const updateAdminUserStaffEmploymentStatusPort: UpdateAdminUserStaffEmploymentStatusPort = {
  async batchUpdateStaffEmploymentStatus(
    input: UpdateAdminUserStaffEmploymentStatusInput,
  ): Promise<UpdateAdminUserStaffEmploymentStatusResult> {
    const response = await executeGraphQL<
      BatchUpdateStaffEmploymentStatusResponse,
      BatchUpdateStaffEmploymentStatusVariables
    >(
      BATCH_UPDATE_STAFF_EMPLOYMENT_STATUS_MUTATION,
      toBatchUpdateStaffEmploymentStatusVariables(input),
    );

    return response.batchUpdateStaffEmploymentStatus;
  },
};

export function requestAdminUsers(input: AdminUserListQuery) {
  return getAdminUsers(adminUserListPort, input);
}

export function requestAdminUserAccountStatusUpdate(input: UpdateAdminUserAccountStatusInput) {
  return updateAdminUserAccountStatus(updateAdminUserAccountStatusPort, input);
}

export function requestAdminUserStaffEmploymentStatusUpdate(
  input: UpdateAdminUserStaffEmploymentStatusInput,
) {
  return updateAdminUserStaffEmploymentStatus(updateAdminUserStaffEmploymentStatusPort, input);
}
