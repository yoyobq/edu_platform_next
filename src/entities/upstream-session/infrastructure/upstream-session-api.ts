import type { OperationVariables } from '@apollo/client';

import { executeGraphQL } from '@/shared/graphql';

export type UpstreamLoginSessionResult = {
  expiresAt: string;
  upstreamSessionToken: string;
};

export type UpstreamSessionRefreshResult = {
  expiresAt: string;
  upstreamSessionToken: string;
};

type LoginUpstreamSessionResponse = {
  loginUpstreamSession: UpstreamLoginSessionResult;
};

type RefreshUpstreamSessionResponse = {
  refreshUpstreamSession: UpstreamSessionRefreshResult;
};

const LOGIN_UPSTREAM_SESSION_MUTATION = `
  mutation LoginUpstreamSession($input: LoginUpstreamSessionInput!) {
    loginUpstreamSession(input: $input) {
      expiresAt
      upstreamSessionToken
    }
  }
`;

const REFRESH_UPSTREAM_SESSION_MUTATION = `
  mutation RefreshUpstreamSession($input: RefreshUpstreamSessionInput!) {
    refreshUpstreamSession(input: $input) {
      expiresAt
      upstreamSessionToken
    }
  }
`;

const UPSTREAM_SESSION_GRAPHQL_OPTIONS = {
  allowAuthRetry: false,
} as const;

export async function requestUpstreamLoginSession(input: { password: string; userId: string }) {
  const response = await executeGraphQL<
    LoginUpstreamSessionResponse,
    OperationVariables & {
      input: {
        password: string;
        userId: string;
      };
    }
  >(
    LOGIN_UPSTREAM_SESSION_MUTATION,
    {
      input,
    },
    UPSTREAM_SESSION_GRAPHQL_OPTIONS,
  );

  return response.loginUpstreamSession;
}

export async function requestUpstreamSessionRefresh(input: { upstreamSessionToken: string }) {
  const response = await executeGraphQL<
    RefreshUpstreamSessionResponse,
    OperationVariables & {
      input: {
        sessionToken: string;
      };
    }
  >(
    REFRESH_UPSTREAM_SESSION_MUTATION,
    {
      input: {
        sessionToken: input.upstreamSessionToken,
      },
    },
    UPSTREAM_SESSION_GRAPHQL_OPTIONS,
  );

  return response.refreshUpstreamSession;
}
