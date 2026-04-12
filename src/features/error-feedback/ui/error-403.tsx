// src/features/error-feedback/ui/error-403.tsx

import { StopOutlined } from '@ant-design/icons';

import { ErrorBlock } from './error-block';

type Error403Props = {
  onRelogin?: () => void;
};

export function Error403({ onRelogin }: Error403Props = {}) {
  return (
    <ErrorBlock
      statusCode={403}
      tone="warning"
      icon={<StopOutlined />}
      title="访问被拒绝"
      description="当前账户的权限不足以访问此页面。如果你认为这是一个错误，请联系管理员或尝试切换账户。"
      actions={[
        { label: '返回首页', to: '/' },
        ...(onRelogin ? [{ label: '重新登录', onClick: onRelogin }] : []),
      ]}
    />
  );
}
