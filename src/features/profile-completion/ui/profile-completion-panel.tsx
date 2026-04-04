import { Alert, Card, Flex, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';

type ProfileCompletionPanelProps = {
  accessGroup: readonly string[];
  children: ReactNode;
  identityHint: string | null;
  isRefreshing: boolean;
};

export function ProfileCompletionPanel({
  accessGroup,
  children,
  identityHint,
  isRefreshing,
}: ProfileCompletionPanelProps) {
  return (
    <Card styles={{ body: { padding: 24 } }}>
      <Flex vertical gap={24}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag color="gold">首次资料补全</Tag>
            {identityHint ? <Tag color="processing">identityHint: {identityHint}</Tag> : null}
            {accessGroup.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              补齐最小资料后再进入工作台
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
              当前前台只处理首次最小资料补全。提交成功后会刷新当前会话，再决定最终跳转。
            </Typography.Paragraph>
          </div>
        </div>

        {isRefreshing ? (
          <Alert
            type="info"
            showIcon
            title="资料已提交，正在刷新当前会话"
            description="前台会先执行 refresh，再重新拉取 me，避免继续持有旧 token claim。"
          />
        ) : null}

        {children}
      </Flex>
    </Card>
  );
}
