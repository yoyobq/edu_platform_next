import { useLoaderData } from 'react-router';

import {
  AdminUserListPageContent,
  requestAdminUserAccountStatusUpdate,
  requestAdminUsers,
  requestAdminUserStaffEmploymentStatusUpdate,
} from '@/features/admin-user-list';
import { Error403 } from '@/features/error-feedback';

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
