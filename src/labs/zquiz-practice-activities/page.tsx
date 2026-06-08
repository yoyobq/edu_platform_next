// src/labs/zquiz-practice-activities/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, List, Modal, Skeleton, Space, Tag, Typography } from 'antd';

import {
  listMyZquizPracticeActivities,
  resolveZquizPracticeErrorMessage,
  startZquizPractice,
  type ZquizPracticeActivity,
  type ZquizPracticeAvailability,
  type ZquizPracticeStartResult,
} from './api';

type ActivityViewState = {
  activities: ZquizPracticeActivity[];
  error: string | null;
  loading: boolean;
};

const AVAILABILITY_LABELS: Record<ZquizPracticeAvailability, string> = {
  CLOSED: '已关闭',
  ENDED: '已结束',
  NOT_STARTED: '未开始',
  OPEN: '开放中',
};

const AVAILABILITY_TAG_COLORS: Record<ZquizPracticeAvailability, string> = {
  CLOSED: 'default',
  ENDED: 'red',
  NOT_STARTED: 'gold',
  OPEN: 'green',
};

function formatDateTime(value: string | null) {
  if (!value) {
    return '不限';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(value: number | null) {
  return value === null ? '不限时' : `${value} 分钟`;
}

function formatAttemptLimit(value: number | null) {
  return value === null ? '不限次' : `${value} 次`;
}

function resolveDisabledReason(activity: ZquizPracticeActivity) {
  if (activity.availability === 'OPEN' && !activity.canStart) {
    return '已达次数上限';
  }

  if (activity.availability === 'NOT_STARTED') {
    return `开放时间：${formatDateTime(activity.startsAt)}`;
  }

  if (activity.availability === 'ENDED') {
    return '已结束';
  }

  if (activity.availability === 'CLOSED') {
    return '已关闭';
  }

  return null;
}

function canStartActivity(activity: ZquizPracticeActivity) {
  return activity.availability === 'OPEN' && activity.canStart;
}

function ActivityMeta({ activity }: { activity: ZquizPracticeActivity }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <span className="text-xs text-text-secondary">题库 ID：{activity.bankId}</span>
      <span className="text-xs text-text-secondary">开始：{formatDateTime(activity.startsAt)}</span>
      <span className="text-xs text-text-secondary">结束：{formatDateTime(activity.endsAt)}</span>
      <span className="text-xs text-text-secondary">
        限时：{formatDuration(activity.durationMinutes)}
      </span>
      <span className="text-xs text-text-secondary">
        次数：{formatAttemptLimit(activity.attemptLimit)}
      </span>
    </div>
  );
}

export function ZquizPracticeActivitiesLabPage() {
  const [state, setState] = useState<ActivityViewState>({
    activities: [],
    error: null,
    loading: true,
  });
  const [startingActivityId, setStartingActivityId] = useState<number | null>(null);
  const [startResult, setStartResult] = useState<{
    activity: ZquizPracticeActivity;
    result: ZquizPracticeStartResult;
  } | null>(null);

  const activityCountText = useMemo(() => {
    if (state.loading) {
      return '读取中';
    }

    return `${state.activities.length} 个练习`;
  }, [state.activities.length, state.loading]);

  const loadActivities = useCallback(async () => {
    setState((current) => ({
      ...current,
      error: null,
      loading: true,
    }));

    try {
      const activities = await listMyZquizPracticeActivities();

      setState({
        activities,
        error: null,
        loading: false,
      });
    } catch (error) {
      setState({
        activities: [],
        error: resolveZquizPracticeErrorMessage(error, '暂时无法读取可选练习列表。'),
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  async function handleStartActivity(activity: ZquizPracticeActivity) {
    setStartingActivityId(activity.id);

    try {
      const result = await startZquizPractice({
        activityId: activity.id,
      });

      setStartResult({
        activity,
        result,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: resolveZquizPracticeErrorMessage(error, '暂时无法开始练习。'),
      }));
    } finally {
      setStartingActivityId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Typography.Title level={3} style={{ marginBottom: 0 }}>
                可选练习
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                按开放状态显示当前账号可参与的练习。
              </Typography.Paragraph>
            </div>

            <Space>
              <Tag color="blue">{activityCountText}</Tag>
              <Button icon={<ReloadOutlined />} loading={state.loading} onClick={loadActivities}>
                刷新
              </Button>
            </Space>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="green">开放中</Tag>
            <Tag color="gold">未开始</Tag>
            <Tag color="red">已结束</Tag>
            <Tag>已关闭</Tag>
          </div>
        </div>
      </Card>

      {state.error ? (
        <Alert
          showIcon
          action={
            <Button size="small" onClick={loadActivities}>
              重试
            </Button>
          }
          message={state.error}
          type="error"
        />
      ) : null}

      <Card title="我的可选练习">
        {state.loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : state.activities.length === 0 ? (
          <Empty description="暂无可选练习" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List<ZquizPracticeActivity>
            dataSource={state.activities}
            itemLayout="vertical"
            renderItem={(activity) => {
              const disabledReason = resolveDisabledReason(activity);
              const isStartEnabled = canStartActivity(activity);

              return (
                <List.Item
                  key={activity.id}
                  actions={[
                    <Button
                      key="start"
                      disabled={!isStartEnabled}
                      icon={<PlayCircleOutlined />}
                      loading={startingActivityId === activity.id}
                      type="primary"
                      onClick={() => void handleStartActivity(activity)}
                    >
                      开始练习
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{activity.title}</span>
                        <Tag color={AVAILABILITY_TAG_COLORS[activity.availability]}>
                          {AVAILABILITY_LABELS[activity.availability]}
                        </Tag>
                      </div>
                    }
                    description={<ActivityMeta activity={activity} />}
                  />

                  {disabledReason ? (
                    <Typography.Text type="secondary">{disabledReason}</Typography.Text>
                  ) : null}
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Modal
        footer={[
          <Button key="close" onClick={() => setStartResult(null)}>
            关闭
          </Button>,
        ]}
        open={startResult !== null}
        title={startResult ? `已获取卷面：${startResult.activity.title}` : '已获取卷面'}
        width={720}
        onCancel={() => setStartResult(null)}
      >
        <Typography.Paragraph type="secondary">
          后端已返回 `startZquizPractice` 结果。当前 lab 暂以原始卷面 JSON
          展示，便于继续核对正式作答页字段。
        </Typography.Paragraph>
        <pre className="max-h-[420px] overflow-auto rounded bg-fill-quaternary p-3 text-xs text-text">
          {JSON.stringify(startResult?.result ?? null, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
