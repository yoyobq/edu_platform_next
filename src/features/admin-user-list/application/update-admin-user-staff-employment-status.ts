import type { AdminUserEmploymentStatus } from './get-admin-users';

export type UpdateAdminUserStaffEmploymentStatusInput = {
  accountIds: readonly number[];
  employmentStatus: AdminUserEmploymentStatus;
};

export type UpdateAdminUserStaffEmploymentStatusResult = {
  isUpdated: boolean;
  requestedCount: number;
  staffs: readonly {
    accountId: number;
    createdAt?: string;
    departmentId?: string | null;
    employmentStatus: AdminUserEmploymentStatus;
    id: string;
    jobTitle?: string | null;
    name: string;
    updatedAt?: string;
  }[];
  updatedCount: number;
};

export type UpdateAdminUserStaffEmploymentStatusPort = {
  batchUpdateStaffEmploymentStatus: (
    input: UpdateAdminUserStaffEmploymentStatusInput,
  ) => Promise<UpdateAdminUserStaffEmploymentStatusResult>;
};

export async function updateAdminUserStaffEmploymentStatus(
  port: UpdateAdminUserStaffEmploymentStatusPort,
  input: UpdateAdminUserStaffEmploymentStatusInput,
): Promise<UpdateAdminUserStaffEmploymentStatusResult> {
  return port.batchUpdateStaffEmploymentStatus(input);
}
