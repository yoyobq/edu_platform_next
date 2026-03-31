import { useCallback, useEffect, useMemo, useState } from 'react';

import type { HomeModuleContract, HomeModuleSummaryItem } from '@/shared/home-modules';

import { runApiHealthCheck } from '../infrastructure/run-api-health-check';

import {
  type ApiHealthCheckPort,
  type ApiHealthStatus,
  getApiHealthStatuses,
} from './get-api-health-statuses';

export const API_HEALTH_STATUS_HOME_RETRY_ACTION_ID = 'api-health-status.retry-home-module';

type ApiHealthStatusHomeState = {
  errorMessage: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  results: readonly ApiHealthStatus[];
};

const INITIAL_STATE: ApiHealthStatusHomeState = {
  errorMessage: null,
  hasLoaded: false,
  isLoading: true,
  results: [],
};

function toSummaryTone(result: ApiHealthStatus): HomeModuleSummaryItem['tone'] {
  return result.ok ? 'success' : 'danger';
}

function toSummaryValue(result: ApiHealthStatus) {
  return result.ok ? '正常' : result.summary;
}

function buildHeadline(results: readonly ApiHealthStatus[]) {
  const healthyCount = results.filter((result) => result.ok).length;

  if (healthyCount === results.length) {
    return `${healthyCount}/${results.length} 条关键检查已通过，可以继续使用默认工作台。`;
  }

  if (healthyCount === 0) {
    return '关键检查暂未通过，建议先重试或回到开始入口继续判断。';
  }

  return `${healthyCount}/${results.length} 条关键检查已通过，仍有链路需要继续观察。`;
}

function readLatestUpdatedAt(results: readonly ApiHealthStatus[]) {
  return results
    .map((result) => result.checkedAt)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1);
}

export function useApiHealthStatusHomeModule(): {
  isPending: boolean;
  module: HomeModuleContract;
  retry: () => void;
} {
  const [state, setState] = useState<ApiHealthStatusHomeState>(INITIAL_STATE);
  const [refreshKey, setRefreshKey] = useState(0);
  const healthCheckPort = useMemo<ApiHealthCheckPort>(
    () => ({
      runCheck: runApiHealthCheck,
    }),
    [],
  );

  useEffect(() => {
    let isActive = true;

    async function loadStatuses() {
      setState((currentState) => ({
        ...currentState,
        errorMessage: null,
        isLoading: true,
      }));

      try {
        const results = await getApiHealthStatuses(healthCheckPort);

        if (!isActive) {
          return;
        }

        setState({
          errorMessage: null,
          hasLoaded: true,
          isLoading: false,
          results,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          errorMessage: error instanceof Error ? error.message : '状态概览加载失败。',
          hasLoaded: true,
          isLoading: false,
        }));
      }
    }

    void loadStatuses();

    return () => {
      isActive = false;
    };
  }, [healthCheckPort, refreshKey]);

  const retry = useCallback(() => {
    setRefreshKey((currentValue) => currentValue + 1);
  }, []);

  const module = useMemo<HomeModuleContract>(() => {
    const primaryAction = {
      id: API_HEALTH_STATUS_HOME_RETRY_ACTION_ID,
      label: state.isLoading && state.hasLoaded ? '重新检测中' : '重新检测',
      kind: 'trigger' as const,
      loading: state.isLoading && state.hasLoaded,
    };

    if (state.errorMessage) {
      return {
        id: 'status-overview',
        title: '系统状态概览',
        intent: '快速确认关键链路是否仍适合继续当前工作台操作。',
        visibility: {
          visible: true,
          reason: 'allowed',
        },
        state: {
          kind: 'error',
          error: {
            title: '状态概览暂时不可用',
            description: state.errorMessage,
            severity: 'warning',
            action: primaryAction,
          },
        },
        entry: {
          primaryAction,
        },
      };
    }

    if (state.hasLoaded && state.results.length === 0) {
      return {
        id: 'status-overview',
        title: '系统状态概览',
        intent: '快速确认关键链路是否仍适合继续当前工作台操作。',
        visibility: {
          visible: true,
          reason: 'allowed',
        },
        state: {
          kind: 'empty',
          empty: {
            title: '当前暂无状态摘要',
            description: '完成一次检测后，这里会收束关键链路的最小状态摘要。',
            action: primaryAction,
          },
        },
        entry: {
          primaryAction,
        },
      };
    }

    return {
      id: 'status-overview',
      title: '系统状态概览',
      intent: '快速确认关键链路是否仍适合继续当前工作台操作。',
      visibility: {
        visible: true,
        reason: 'allowed',
      },
      state: {
        kind: 'ready',
        summary: {
          headline: buildHeadline(state.results),
          items: state.results.map((result) => ({
            label: result.title,
            value: toSummaryValue(result),
            tone: toSummaryTone(result),
          })),
          badges: [
            {
              text: state.results.every((result) => result.ok) ? '链路稳定' : '建议关注异常链路',
              tone: state.results.every((result) => result.ok) ? 'success' : 'warning',
            },
          ],
          updatedAt: readLatestUpdatedAt(state.results),
        },
        isRefetching: state.isLoading && state.hasLoaded,
      },
      entry: {
        primaryAction,
      },
    };
  }, [state.errorMessage, state.hasLoaded, state.isLoading, state.results]);

  return {
    isPending: state.isLoading && !state.hasLoaded,
    module,
    retry,
  };
}
