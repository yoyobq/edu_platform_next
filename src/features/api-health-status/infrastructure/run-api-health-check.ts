import type {
  ApiHealthCheckDefinition,
  ApiHealthStatus,
} from '../application/get-api-health-statuses';

function getApiOrigin(): string {
  const configuredEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT;

  if (configuredEndpoint) {
    try {
      return new URL(configuredEndpoint).origin;
    } catch {
      return '';
    }
  }

  return '';
}

function getHealthEndpoint(definition: ApiHealthCheckDefinition): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const overrideEnvKey =
    definition.id === 'health' ? 'VITE_API_HEALTH_ENDPOINT' : 'VITE_API_READINESS_ENDPOINT';
  const overrideValue = env[overrideEnvKey];

  if (typeof overrideValue === 'string' && overrideValue.trim()) {
    return overrideValue;
  }

  const apiOrigin = getApiOrigin();

  if (!apiOrigin) {
    return '';
  }

  const pathname = definition.id === 'health' ? '/health' : '/health/readiness';
  return new URL(pathname, apiOrigin).toString();
}

function buildSummary(status: number | null, payload: unknown): string {
  if (status === null) {
    return '请求未返回有效状态码。';
  }

  if (payload && typeof payload === 'object') {
    const message = Reflect.get(payload, 'message');
    const statusText = Reflect.get(payload, 'status');

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (typeof statusText === 'string' && statusText.trim()) {
      return statusText;
    }
  }

  if (status >= 200 && status < 300) {
    return 'ok';
  }

  return `HTTP ${status}`;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

export async function runApiHealthCheck(
  definition: ApiHealthCheckDefinition,
): Promise<ApiHealthStatus> {
  const url = getHealthEndpoint(definition);

  if (!url) {
    return {
      ...definition,
      url,
      ok: false,
      status: null,
      durationMs: null,
      checkedAt: new Date().toISOString(),
      summary: '未配置可用的 endpoint。',
    };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    const payload = await readResponsePayload(response);
    const durationMs = Math.round(performance.now() - startedAt);

    return {
      ...definition,
      url,
      ok: response.ok,
      status: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      summary: buildSummary(response.status, payload),
    };
  } catch (error) {
    return {
      ...definition,
      url,
      ok: false,
      status: null,
      durationMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
      summary: error instanceof Error ? error.message : '请求失败。',
    };
  }
}
