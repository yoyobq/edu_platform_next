// src/labs/upstream-session-reference/page.tsx

import { useCallback, useRef, useState } from 'react';
import {
  ApiOutlined,
  ClearOutlined,
  LoginOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Space, Tag, Timeline, Typography } from 'antd';
import { useLoaderData } from 'react-router';

import {
  formatUpstreamSessionDateTime,
  resolveUpstreamErrorMessage,
  type StoredUpstreamSession,
  type UpstreamAccountIdentity,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import { upstreamSessionReferenceLabAccess } from './access';
import { upstreamSessionReferenceLabMeta } from './meta';

type UpstreamSessionReferenceLabLoaderData = {
  currentAccount: UpstreamAccountIdentity;
};

type ReferencePendingAction = {
  createdAt: string;
  label: string;
};

type ReferenceEvent = {
  createdAt: string;
  detail: string;
  id: number;
  status: 'error' | 'info' | 'success';
  title: string;
};

const REFERENCE_STEPS = [
  'app/router loader 注入 currentAccount',
  'lab 页面调用 useUpstreamLoginModalController',
  'UpstreamLoginModal 只接收 modalProps',
  '业务动作只保存为 pendingAction',
  'upstream proxy GraphQL 统一走 executeUpstreamSessionGraphQL',
] as const;

function createPendingAction(label: string): ReferencePendingAction {
  return {
    createdAt: new Date().toISOString(),
    label,
  };
}

function maskUpstreamSessionToken(session: StoredUpstreamSession | null) {
  const token = session?.upstreamSessionToken.trim();

  if (!token) {
    return '未建立';
  }

  if (token.length <= 12) {
    return `${token.slice(0, 2)}...${token.slice(-2)}`;
  }

  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function resolveEventColor(status: ReferenceEvent['status']) {
  if (status === 'success') {
    return 'green';
  }

  if (status === 'error') {
    return 'red';
  }

  return 'blue';
}

export function UpstreamSessionReferenceLabPage() {
  const loaderData = useLoaderData() as UpstreamSessionReferenceLabLoaderData | null;
  const currentAccount = loaderData?.currentAccount ?? null;
  const eventIdRef = useRef(0);
  const [events, setEvents] = useState<ReferenceEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const appendEvent = useCallback((event: Omit<ReferenceEvent, 'createdAt' | 'id'>) => {
    eventIdRef.current += 1;
    setEvents((items) =>
      [
        {
          ...event,
          createdAt: new Date().toISOString(),
          id: eventIdRef.current,
        },
        ...items,
      ].slice(0, 8),
    );
  }, []);

  const {
    clearSession,
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    refreshSession,
    session: storedSession,
  } = useUpstreamLoginModalController<ReferencePendingAction>({
    account: currentAccount,
    keepAlive: true,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '暂时无法登录 upstream。'),
    onLoginSuccess: ({ pendingAction, session }) => {
      appendEvent({
        detail: pendingAction
          ? `${pendingAction.label} 已获得 upstream session：${maskUpstreamSessionToken(session)}`
          : `已建立 upstream session：${maskUpstreamSessionToken(session)}`,
        status: 'success',
        title: '登录完成',
      });
    },
  });

  const runSessionRequiredAction = useCallback(() => {
    const pendingAction = createPendingAction('需要 upstream session 的参考动作');

    if (!storedSession) {
      openLoginModal({
        pendingAction,
      });
      return;
    }

    appendEvent({
      detail: `${pendingAction.label} 已直接复用当前 session：${maskUpstreamSessionToken(
        storedSession,
      )}`,
      status: 'success',
      title: '动作完成',
    });
  }, [appendEvent, openLoginModal, storedSession]);

  const simulateExpiredSession = useCallback(() => {
    const pendingAction = createPendingAction('过期后恢复的参考动作');

    if (!storedSession) {
      openLoginModal({
        loginError: '当前没有 upstream session，请先登录后再模拟过期恢复。',
        pendingAction,
      });
      return;
    }

    openLoginModalForExpiredSession({
      loginError: 'upstream 会话已失效，请重新登录后继续参考动作。',
      pendingAction,
      session: storedSession,
    });
    appendEvent({
      detail: '已清理旧 upstream session，并保留 pendingAction 等待重新登录。',
      status: 'info',
      title: '模拟过期',
    });
  }, [appendEvent, openLoginModal, openLoginModalForExpiredSession, storedSession]);

  const refreshCurrentSession = useCallback(async () => {
    if (!storedSession) {
      openLoginModal({
        pendingAction: createPendingAction('刷新前建立 upstream session'),
      });
      return;
    }

    setIsRefreshing(true);

    try {
      const nextSession = await refreshSession(storedSession);

      appendEvent({
        detail: `刷新完成，当前 session：${maskUpstreamSessionToken(nextSession)}`,
        status: 'success',
        title: '刷新完成',
      });
    } catch (error) {
      appendEvent({
        detail: resolveUpstreamErrorMessage(error, 'upstream session 刷新失败。'),
        status: 'error',
        title: '刷新失败',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [appendEvent, openLoginModal, refreshSession, storedSession]);

  if (!currentAccount) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert showIcon type="warning" title="当前登录会话尚未恢复，请稍后重试。" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              Upstream Session Reference
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {upstreamSessionReferenceLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <Space wrap>
            <Tag color="blue">负责人：{upstreamSessionReferenceLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{upstreamSessionReferenceLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{upstreamSessionReferenceLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">
              访问级别：{upstreamSessionReferenceLabAccess.allowedAccessLevels.join(', ')}
            </Tag>
          </Space>
        </div>
      </Card>

      <ResponsiveGrid
        className="gap-4"
        columns={{ compact: 1, wide: 'minmax(0, 1fr) minmax(360px, 480px)' }}
      >
        <Card title="当前状态">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="本站账号">{currentAccount.displayName}</Descriptions.Item>
            <Descriptions.Item label="本站 accountId">{currentAccount.accountId}</Descriptions.Item>
            <Descriptions.Item label="upstream 登录账号">
              {storedSession?.upstreamLoginId ?? '未登录'}
            </Descriptions.Item>
            <Descriptions.Item label="upstream session">
              {storedSession ? <Tag color="green">已建立</Tag> : <Tag>未建立</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="token 摘要">
              {maskUpstreamSessionToken(storedSession)}
            </Descriptions.Item>
            <Descriptions.Item label="过期时间">
              {formatUpstreamSessionDateTime(storedSession?.expiresAt ?? null)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="参考动作">
          <div className="flex flex-col gap-3">
            <Button
              icon={<LoginOutlined />}
              type="primary"
              onClick={() =>
                openLoginModal({
                  pendingAction: createPendingAction('手动 upstream 登录'),
                })
              }
            >
              登录 upstream
            </Button>
            <Button icon={<ApiOutlined />} onClick={runSessionRequiredAction}>
              执行需要 session 的动作
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={isRefreshing}
              onClick={refreshCurrentSession}
            >
              刷新 upstream session
            </Button>
            <Button icon={<WarningOutlined />} onClick={simulateExpiredSession}>
              模拟过期后恢复
            </Button>
            <Button
              danger
              icon={<ClearOutlined />}
              onClick={() => {
                clearSession();
                appendEvent({
                  detail: '已清除浏览器内保存的 upstream session。',
                  status: 'info',
                  title: 'session 已清除',
                });
              }}
            >
              清除 session
            </Button>
          </div>
        </Card>
      </ResponsiveGrid>

      <ResponsiveGrid
        className="gap-4"
        columns={{ compact: 1, wide: 'minmax(320px, 420px) minmax(0, 1fr)' }}
      >
        <Card title="标准接入顺序">
          <div className="flex flex-col gap-3">
            {REFERENCE_STEPS.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <Tag color="blue">{index + 1}</Tag>
                <Typography.Text>{step}</Typography.Text>
              </div>
            ))}
          </div>
        </Card>

        <Card title="事件记录">
          {events.length ? (
            <Timeline
              items={events.map((event) => ({
                children: (
                  <div className="flex flex-col gap-1">
                    <Typography.Text strong>{event.title}</Typography.Text>
                    <Typography.Text type="secondary">{event.detail}</Typography.Text>
                    <Typography.Text type="secondary">
                      {formatUpstreamSessionDateTime(event.createdAt)}
                    </Typography.Text>
                  </div>
                ),
                color: resolveEventColor(event.status),
              }))}
            />
          ) : (
            <Empty
              description="还没有 upstream session 事件"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Card>
      </ResponsiveGrid>

      <UpstreamLoginModal
        {...upstreamLoginModalProps}
        description="这个参考页只展示 upstream session 标准接入方式，不绑定具体业务接口。"
        title="需要登录 upstream"
      />
    </div>
  );
}
