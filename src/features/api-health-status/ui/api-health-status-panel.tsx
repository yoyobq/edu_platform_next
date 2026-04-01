// src/features/api-health-status/ui/api-health-status-panel.tsx

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Flex, Skeleton, Tag, Typography } from 'antd';

import {
  type ApiHealthCheckPort,
  type ApiHealthStatus,
  getApiHealthStatuses,
} from '../application/get-api-health-statuses';

type ApiHealthPanelState = {
  isLoading: boolean;
  results: readonly ApiHealthStatus[];
};

const INITIAL_STATE: ApiHealthPanelState = {
  isLoading: true,
  results: [],
};

function formatCheckedAt(value: string | null): string {
  if (!value) {
    return '尚未检测';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

type ApiHealthStatusPanelProps = {
  healthCheckPort: ApiHealthCheckPort;
};

export function ApiHealthStatusPanel({ healthCheckPort }: ApiHealthStatusPanelProps) {
  const [state, setState] = useState<ApiHealthPanelState>(INITIAL_STATE);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadHealthStatuses() {
      setState((currentState) => ({
        ...currentState,
        isLoading: true,
      }));

      const results = await getApiHealthStatuses(healthCheckPort);

      if (!isActive) {
        return;
      }

      setState({
        isLoading: false,
        results,
      });
    }

    void loadHealthStatuses();

    return () => {
      isActive = false;
    };
  }, [healthCheckPort, refreshKey]);

  const healthyCount = state.results.filter((result) => result.ok).length;

  return (
    <section className="max-w-5xl rounded-card bg-bg-container p-6 shadow-card">
      <Flex vertical gap={24}>
        <Flex align="center" justify="space-between" gap={16}>
          <Flex vertical gap={4}>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              API 状态面板
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              观察公开 health 与 readiness 链路，替代原有的 demo 假数据。
            </Typography.Paragraph>
          </Flex>

          <Button
            onClick={() => {
              setState(INITIAL_STATE);
              setRefreshKey((currentValue) => currentValue + 1);
            }}
            disabled={state.isLoading}
          >
            重新检测
          </Button>
        </Flex>

        {state.isLoading ? (
          <div className="rounded-card">
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ) : (
          <Flex vertical gap={16}>
            <Flex gap={3}>
              <Tag color={healthyCount === state.results.length ? 'green' : 'gold'}>
                {healthyCount}/{state.results.length} 成功
              </Tag>
            </Flex>

            <div className="grid gap-4 md:grid-cols-2">
              {state.results.map((result) => (
                <Card key={result.id} title={result.title}>
                  <Flex vertical gap={12}>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {result.description}
                    </Typography.Paragraph>

                    <div className="flex flex-col gap-2">
                      <div className="text-xs">
                        <span className="font-semibold text-text-secondary">Endpoint </span>
                        <span className="text-text-secondary">{result.url || '未配置'}</span>
                      </div>
                      <div className="flex gap-6 text-xs text-text-secondary">
                        <span>
                          <span className="font-semibold text-text-secondary">Status </span>
                          <span>{result.status ?? '—'}</span>
                        </span>
                        <span>
                          <span className="font-semibold text-text-secondary">耗时 </span>
                          <span>{result.durationMs != null ? `${result.durationMs}ms` : '—'}</span>
                        </span>
                        <span>
                          <span className="font-semibold text-text-secondary">检测时间 </span>
                          <span>{formatCheckedAt(result.checkedAt)}</span>
                        </span>
                      </div>
                    </div>

                    <Alert type={result.ok ? 'success' : 'error'} showIcon title={result.summary} />
                  </Flex>
                </Card>
              ))}
            </div>
          </Flex>
        )}
      </Flex>
    </section>
  );
}
