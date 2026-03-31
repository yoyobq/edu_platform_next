// src/pages/home/index.tsx

import { Alert, Button, Card, Flex, Skeleton, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import {
  API_HEALTH_STATUS_HOME_RETRY_ACTION_ID,
  useApiHealthStatusHomeModule,
} from '@/features/api-health-status';
import { useAuthSessionState } from '@/features/auth';
import { buildHomePageViewModel, OPEN_ENTRY_SIDECAR_ACTION_ID } from '@/features/workbench-home';

import {
  type HomeModuleAction,
  type HomeModuleSummaryTone,
  isVisibleHomeModule,
  type VisibleHomeModuleContract,
} from '@/shared/home-modules';
import { requestOpenEntrySidecar } from '@/shared/workbench-events';

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) {
    return '刚刚';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

function toTagColor(tone: HomeModuleSummaryTone | undefined) {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    default:
      return 'default';
  }
}

function HomeModuleCard({
  module,
  onAction,
}: {
  module: VisibleHomeModuleContract;
  onAction: (action: HomeModuleAction) => void;
}) {
  const secondaryActions = module.entry.secondaryActions ?? [];
  let stateContent: ReactNode = null;

  if (module.state.kind === 'ready') {
    stateContent = (
      <Flex vertical gap={16}>
        <div className="space-y-3">
          <Typography.Text strong>{module.state.summary.headline}</Typography.Text>
          {module.state.summary.items && module.state.summary.items.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {module.state.summary.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-block border border-border bg-bg-layout px-4 py-3"
                >
                  <Typography.Text type="secondary">{item.label}</Typography.Text>
                  <Typography.Paragraph style={{ marginBottom: 0, marginTop: 4 }}>
                    {item.value}
                  </Typography.Paragraph>
                </div>
              ))}
            </div>
          ) : null}
          {module.state.summary.badges && module.state.summary.badges.length > 0 ? (
            <Flex gap={8} wrap>
              {module.state.summary.badges.map((badge) => (
                <Tag key={badge.text} color={toTagColor(badge.tone)}>
                  {badge.text}
                </Tag>
              ))}
            </Flex>
          ) : null}
        </div>
        <Typography.Text type="secondary">
          最近更新：{formatUpdatedAt(module.state.summary.updatedAt)}
        </Typography.Text>
      </Flex>
    );
  } else if (module.state.kind === 'empty') {
    const emptyAction = module.state.empty.action;

    stateContent = (
      <Alert
        type="info"
        showIcon
        title={module.state.empty.title}
        description={module.state.empty.description}
        action={
          emptyAction ? (
            <Button size="small" type="link" onClick={() => onAction(emptyAction)}>
              {emptyAction.label}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    const errorAction = module.state.error.action;

    stateContent = (
      <Alert
        type={module.state.error.severity === 'error' ? 'error' : 'warning'}
        showIcon
        title={module.state.error.title}
        description={module.state.error.description}
        action={
          errorAction ? (
            <Button size="small" type="link" onClick={() => onAction(errorAction)}>
              {errorAction.label}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card styles={{ body: { display: 'flex', flexDirection: 'column', gap: 20, height: '100%' } }}>
      <div className="space-y-3">
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {module.title}
          </Typography.Title>
          <Tag color="processing">允许显示</Tag>
        </Flex>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {module.intent}
        </Typography.Paragraph>
      </div>

      {stateContent}

      <Flex gap={12} wrap>
        <Button
          type="primary"
          loading={module.entry.primaryAction.loading}
          disabled={module.entry.primaryAction.disabled}
          onClick={() => onAction(module.entry.primaryAction)}
        >
          {module.entry.primaryAction.label}
        </Button>
        {secondaryActions.map((action) => (
          <Button
            key={action.id}
            loading={action.loading}
            disabled={action.disabled}
            onClick={() => onAction(action)}
          >
            {action.label}
          </Button>
        ))}
      </Flex>
    </Card>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const authSession = useAuthSessionState();
  const { isPending, module: statusOverviewModule, retry } = useApiHealthStatusHomeModule();
  const viewModel = buildHomePageViewModel({
    session: {
      accessGroup: authSession.snapshot?.accessGroup,
      displayName: authSession.snapshot?.displayName,
      role: authSession.snapshot?.role,
    },
    statusOverviewModule,
  });
  const visibleModules = viewModel.modules.filter(isVisibleHomeModule);

  const handleAction = (action: HomeModuleAction) => {
    if (action.disabled) {
      return;
    }

    if (action.kind === 'navigate' && action.to) {
      navigate(action.to);
      return;
    }

    if (action.id === OPEN_ENTRY_SIDECAR_ACTION_ID) {
      requestOpenEntrySidecar();
      return;
    }

    if (action.id === API_HEALTH_STATUS_HOME_RETRY_ACTION_ID) {
      retry();
    }
  };

  return (
    <Flex vertical gap={24}>
      <Card>
        <Flex vertical gap={12}>
          <Flex align="center" gap={12} wrap>
            <Typography.Title level={2} style={{ marginBottom: 0 }}>
              默认工作台
            </Typography.Title>
            <Tag color="blue">登录后默认入口</Tag>
            <Tag color="purple">{viewModel.templateLabel}</Tag>
          </Flex>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
            {viewModel.templateDescription}
          </Typography.Paragraph>
        </Flex>
      </Card>

      {isPending ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={`home-module-skeleton-${index}`}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {visibleModules.map((module) => (
            <HomeModuleCard key={module.id} module={module} onAction={handleAction} />
          ))}
        </div>
      )}
    </Flex>
  );
}
