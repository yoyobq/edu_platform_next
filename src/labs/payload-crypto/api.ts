// eslint-disable-next-line boundaries/dependencies
import { getAuthSessionSnapshot } from '@/features/auth';

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{
    message?: string;
  }>;
};

export function getGraphQLEndpoint(): string {
  const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT;

  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new Error('未配置可用的 VITE_GRAPHQL_ENDPOINT。');
  }

  return endpoint;
}

export async function requestGraphQL<TData, TVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const snapshot = getAuthSessionSnapshot();
  if (snapshot?.accessToken) {
    headers.Authorization = `Bearer ${snapshot.accessToken}`;
  }

  const response = await fetch(getGraphQLEndpoint(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const payload = (await response.json()) as GraphQLResponse<TData>;

  if (!response.ok) {
    const responseError = payload.errors?.[0]?.message;

    throw new Error(responseError || `请求失败（HTTP ${response.status}）。`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'GraphQL 请求失败。');
  }

  if (!payload.data) {
    throw new Error('GraphQL 未返回 data。');
  }

  return payload.data;
}
