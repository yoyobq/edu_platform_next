import type { AdminUserAccountStatus } from './get-admin-users';

export type UpdateAdminUserAccountStatusInput = {
  accountIds: readonly number[];
  status: AdminUserAccountStatus;
};

export type UpdateAdminUserAccountStatusResult = {
  accounts: readonly {
    createdAt?: string;
    id: number;
    identityHint?: string | null;
    loginEmail?: string | null;
    loginName?: string | null;
    status: AdminUserAccountStatus;
    updatedAt: string;
  }[];
  isUpdated: boolean;
  requestedCount: number;
  updatedCount: number;
};

export type UpdateAdminUserAccountStatusPort = {
  batchUpdateAccountStatus: (
    input: UpdateAdminUserAccountStatusInput,
  ) => Promise<UpdateAdminUserAccountStatusResult>;
};

export async function updateAdminUserAccountStatus(
  port: UpdateAdminUserAccountStatusPort,
  input: UpdateAdminUserAccountStatusInput,
): Promise<UpdateAdminUserAccountStatusResult> {
  return port.batchUpdateAccountStatus(input);
}
