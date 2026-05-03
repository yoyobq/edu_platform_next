import { executeGraphQL } from '@/shared/graphql';

import {
  ADMIN_USER_ACCOUNT_STATUSES,
  type AdminUserAccountStatus,
  type AdminUserEmploymentStatus,
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

export function requestAdminUserAccountStatusUpdate(input: UpdateAdminUserAccountStatusInput) {
  return updateAdminUserAccountStatus(updateAdminUserAccountStatusPort, input);
}

export function requestAdminUserStaffEmploymentStatusUpdate(
  input: UpdateAdminUserStaffEmploymentStatusInput,
) {
  return updateAdminUserStaffEmploymentStatus(updateAdminUserStaffEmploymentStatusPort, input);
}
