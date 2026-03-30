// src/features/api-health-status/application/get-api-health-statuses.ts

export type ApiHealthCheckDefinition = {
  id: 'health' | 'readiness';
  title: string;
  description: string;
};

export type ApiHealthStatus = {
  id: ApiHealthCheckDefinition['id'];
  title: string;
  description: string;
  url: string;
  ok: boolean;
  status: number | null;
  durationMs: number | null;
  checkedAt: string | null;
  summary: string;
};

export type ApiHealthCheckPort = {
  runCheck: (definition: ApiHealthCheckDefinition) => Promise<ApiHealthStatus>;
};

const API_HEALTH_CHECK_DEFINITIONS: readonly ApiHealthCheckDefinition[] = [
  {
    id: 'health',
    title: '后端连通性',
    description: '验证 API 后端是否可达、进程是否存活。',
  },
  {
    id: 'readiness',
    title: '数据库就绪',
    description: '验证后端已连接数据库且可正常响应读写请求。',
  },
];

export async function getApiHealthStatuses(
  port: ApiHealthCheckPort,
): Promise<readonly ApiHealthStatus[]> {
  return Promise.all(API_HEALTH_CHECK_DEFINITIONS.map((definition) => port.runCheck(definition)));
}
