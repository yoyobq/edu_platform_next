// src/features/auth/infrastructure/auth-api.ts

import type { AuthApiPort } from '../application/ports';
import type { AuthLoginInput, AuthSessionSnapshot } from '../application/types';

import { mapLoginResultToSessionSnapshot } from './mapper';

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{
    message?: string;
  }>;
};

type LoginMutationResponse = {
  login: {
    accessToken: string;
    accountId: number;
    refreshToken: string;
    role: AuthSessionSnapshot['role'];
    userInfo: {
      accessGroup: readonly AuthSessionSnapshot['role'][];
      avatarUrl: string | null;
      nickname: string | null;
    } | null;
  };
};

const LOGIN_MUTATION = `
  mutation Login($input: AuthLoginInput!) {
    login(input: $input) {
      accessToken
      accountId
      refreshToken
      role
      userInfo {
        accessGroup
        avatarUrl
        nickname
      }
    }
  }
`;

function getGraphQLEndpoint(): string {
  const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT;

  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new Error('未配置可用的 VITE_GRAPHQL_ENDPOINT。');
  }

  return endpoint;
}

async function requestGraphQL<TData, TVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  const response = await fetch(getGraphQLEndpoint(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
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

export const authApi: AuthApiPort = {
  async login(input: AuthLoginInput) {
    const response = await requestGraphQL<LoginMutationResponse, { input: AuthLoginInput }>(
      LOGIN_MUTATION,
      { input },
    );

    return mapLoginResultToSessionSnapshot(response.login);
  },
};
