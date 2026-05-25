// src/entities/upstream-session/ui/upstream-session-status-card.tsx

import { Card, Descriptions } from 'antd';
import type { ReactNode } from 'react';

import { formatUpstreamSessionDateTime } from '../application/upstream-session-format';

export type UpstreamSessionStatusCardItem = {
  label: ReactNode;
  value: ReactNode;
};

type UpstreamSessionStatusCardProps = {
  accountDisplayName?: string | null;
  extraItems?: readonly UpstreamSessionStatusCardItem[];
  title?: ReactNode;
  upstreamExpiresAt?: string | null;
  upstreamLoginId?: string | null;
};

export function UpstreamSessionStatusCard({
  accountDisplayName,
  extraItems = [],
  title = '当前状态',
  upstreamExpiresAt,
  upstreamLoginId,
}: UpstreamSessionStatusCardProps) {
  return (
    <Card title={title}>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="当前账号">
          {accountDisplayName?.trim() || '未恢复'}
        </Descriptions.Item>
        {extraItems.map((item, index) => (
          <Descriptions.Item key={index} label={item.label}>
            {item.value}
          </Descriptions.Item>
        ))}
        <Descriptions.Item label="upstream 登录名">
          {upstreamLoginId?.trim() || '未保存'}
        </Descriptions.Item>
        <Descriptions.Item label="upstream token 过期时间">
          {formatUpstreamSessionDateTime(upstreamExpiresAt)}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
