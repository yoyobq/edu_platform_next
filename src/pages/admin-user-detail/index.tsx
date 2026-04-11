import { Typography } from 'antd';
import { useLoaderData, useParams } from 'react-router';

import { AdminUserDetailPageContent } from '@/features/admin-user-detail';

export function AdminUserDetailPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;
  const { id = '' } = useParams();
  const accountId = Number.parseInt(id, 10);

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

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return (
      <div className="rounded-block border border-warning-border bg-warning-bg p-6">
        <Typography.Title level={3}>无效的账户 ID</Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          当前路由参数不是可用的用户账户标识。
        </Typography.Paragraph>
      </div>
    );
  }

  return <AdminUserDetailPageContent accountId={accountId} />;
}
