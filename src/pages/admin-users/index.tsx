import { useLoaderData } from 'react-router';

import {
  AdminUserListPageContent,
  requestAdminUserAccountStatusUpdate,
  requestAdminUserStaffEmploymentStatusUpdate,
} from '@/features/admin-user-list';
import { Error403 } from '@/features/error-feedback';

import { requestAdminUsers } from '@/entities/admin-user';

export function AdminUsersPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <AdminUserListPageContent
      loadUsers={requestAdminUsers}
      updateAccountStatus={requestAdminUserAccountStatusUpdate}
      updateStaffEmploymentStatus={requestAdminUserStaffEmploymentStatusUpdate}
    />
  );
}
