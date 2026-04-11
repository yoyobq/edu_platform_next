import { Typography } from 'antd';
import { useLoaderData } from 'react-router';

import {
  AdminUserListPageContent,
  requestAdminUserAccountStatusUpdate,
  requestAdminUsers,
  requestAdminUserStaffEmploymentStatusUpdate,
} from '@/features/admin-user-list';

export function AdminUsersPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return (
      <div className="rounded-block border border-warning-border bg-warning-bg p-6">
        <Typography.Title level={3}>访问被拒绝</Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          当前路由已被访问控制规则拦截。
        </Typography.Paragraph>
      </div>
    );
  }

  return (
    <AdminUserListPageContent
      loadUsers={requestAdminUsers}
      updateAccountStatus={requestAdminUserAccountStatusUpdate}
      updateStaffEmploymentStatus={requestAdminUserStaffEmploymentStatusUpdate}
    />
  );
}
