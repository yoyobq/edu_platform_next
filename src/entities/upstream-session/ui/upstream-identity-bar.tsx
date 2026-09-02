// src/entities/upstream-session/ui/upstream-identity-bar.tsx

import { LoadingOutlined, SwapOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Tag, Tooltip } from 'antd';

import type { VerifiedStaffIdentityResult } from '../infrastructure/staff-directory';

import './upstream-identity-bar.css';

export function UpstreamIdentityBar({
  connected,
  disabled = false,
  error,
  identity,
  loading = false,
  mismatchMessage,
  upstreamLoginId,
  onConnect,
}: {
  connected: boolean;
  disabled?: boolean;
  error?: string | null;
  identity?: VerifiedStaffIdentityResult | null;
  loading?: boolean;
  mismatchMessage?: string | null;
  upstreamLoginId?: string | null;
  onConnect: () => void;
}) {
  const identityLabel = identity
    ? `${identity.personId} ${identity.personName || '未命名'}`
    : loading
      ? `正在确认${upstreamLoginId ? `（${upstreamLoginId}）` : ''}`
      : connected
        ? `${upstreamLoginId || '已连接'}（待确认）`
        : '未连接';

  return (
    <div className="upstream-identity-bar">
      <span className="upstream-identity-bar-label">
        {loading ? <LoadingOutlined spin /> : <UserOutlined />}
        <span>校园网当前身份：{identityLabel}</span>
      </span>
      {error ? (
        <Tooltip title={error}>
          <Tag color="warning">身份确认失败</Tag>
        </Tooltip>
      ) : null}
      {mismatchMessage ? (
        <Tooltip title={mismatchMessage}>
          <Tag color="warning">与所选教师不同</Tag>
        </Tooltip>
      ) : null}
      <Button
        disabled={disabled}
        icon={<SwapOutlined />}
        size="small"
        type="link"
        onClick={onConnect}
      >
        {connected ? '切换账号' : '连接账号'}
      </Button>
    </div>
  );
}
