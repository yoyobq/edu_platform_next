// src/features/auth/infrastructure/auth-api.ts

import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, type GraphQLAuthMode } from '@/shared/graphql';
import { isGraphQLIngressError } from '@/shared/graphql/errors';

import type { AuthApiPort } from '../application/ports';
import type { AuthLoginInput, AuthSessionSnapshot } from '../application/types';

import { mapSessionResultToSessionSnapshot, mapTokensToPendingSession } from './mapper';

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

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options?: {
    accessToken?: string;
    authMode?: GraphQLAuthMode;
  },
): Promise<TData> {
  return executeGraphQL(query, variables, {
    accessToken: options?.accessToken,
    allowAuthRetry: false,
    authMode: options?.authMode,
  });
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
      { authMode: 'none' },
    );

    return mapTokensToPendingSession(response.login);
  },
  async refresh(input: { refreshToken: string }) {
    const response = await requestGraphQL<
      RefreshMutationResponse,
      { input: { refreshToken: string } }
    >(
      REFRESH_MUTATION,
      {
        input,
      },
      { authMode: 'none' },
    );

    return hydrateSession(response.refresh);
  },
  async restore(session) {
    try {
      return await hydrateSession(session);
    } catch (error) {
      if (isGraphQLIngressError(error) && error.type === 'auth') {
        return this.refresh({
          refreshToken: session.refreshToken,
        });
      }

      throw error;
    }
  },
};
