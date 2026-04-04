// src/features/auth/infrastructure/auth-api.ts

import type { AuthApiPort } from '../application/ports';
import type { AuthLoginInput, AuthSessionSnapshot } from '../application/types';

import { mapSessionResultToSessionSnapshot } from './mapper';

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{
    message?: string;
  }>;
};

type SessionTokensDTO = {
  accessToken: string;
  refreshToken: string;
};

type SessionQueryDTO = {
  account: {
    id: number;
    identityHint: string | null;
    loginEmail: string | null;
    loginName: string | null;
    status: string;
  };
  accountId: number;
  identity:
    | {
        __typename: 'StaffType';
        accountId: number;
        createdAt: string;
        departmentId: string | null;
        employmentStatus: string;
        id: string;
        jobTitle: string | null;
        name: string;
        remark: string | null;
        updatedAt: string;
      }
    | {
        __typename: 'StudentType';
        accountId: number;
        classId: number | null;
        createdAt: string;
        id: string;
        name: string;
        remarks: string | null;
        studentDepartmentId: string;
        studentStatus: string;
        updatedAt: string;
      }
    | null;
  needsProfileCompletion: boolean;
  userInfo: {
    accessGroup: readonly string[];
    avatarUrl: string | null;
    email: string | null;
    nickname: string | null;
  };
};

type LoginMutationResponse = {
  login: SessionTokensDTO;
};

type MeQueryResponse = {
  me: SessionQueryDTO;
};

type RefreshMutationResponse = {
  refresh: SessionTokensDTO;
};

const LOGIN_MUTATION = `
  mutation Login($input: AuthLoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

const REFRESH_MUTATION = `
  mutation Refresh($input: AuthRefreshInput!) {
    refresh(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

const ME_QUERY = `
  query Me {
    me {
      accountId
      account {
        id
        identityHint
        loginEmail
        loginName
        status
      }
      userInfo {
        accessGroup
        avatarUrl
        email
        nickname
      }
      identity {
        __typename
        ... on StaffType {
          accountId
          createdAt
          departmentId
          employmentStatus
          id
          jobTitle
          name
          remark
          updatedAt
        }
        ... on StudentType {
          accountId
          classId
          createdAt
          studentDepartmentId: departmentId
          id
          name
          remarks
          studentStatus
          updatedAt
        }
      }
      needsProfileCompletion
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
  options?: {
    accessToken?: string;
  },
): Promise<TData> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (options?.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
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

async function fetchSession(accessToken: string) {
  const response = await requestGraphQL<MeQueryResponse, Record<string, never>>(
    ME_QUERY,
    {},
    { accessToken },
  );

  return response.me;
}

async function hydrateSession(tokens: SessionTokensDTO): Promise<AuthSessionSnapshot> {
  const session = await fetchSession(tokens.accessToken);

  return mapSessionResultToSessionSnapshot(tokens, session);
}

export const authApi: AuthApiPort = {
  async login(input: AuthLoginInput) {
    const response = await requestGraphQL<LoginMutationResponse, { input: AuthLoginInput }>(
      LOGIN_MUTATION,
      { input },
    );

    return hydrateSession(response.login);
  },
  async refresh(input: { refreshToken: string }) {
    const response = await requestGraphQL<
      RefreshMutationResponse,
      { input: { refreshToken: string } }
    >(REFRESH_MUTATION, {
      input,
    });

    return hydrateSession(response.refresh);
  },
  async restore(session) {
    try {
      return await hydrateSession(session);
    } catch {
      return this.refresh({
        refreshToken: session.refreshToken,
      });
    }
  },
};
