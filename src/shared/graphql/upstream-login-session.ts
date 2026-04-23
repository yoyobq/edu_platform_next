import type { OperationVariables } from '@apollo/client';

import { executeGraphQL } from './request';

export type UpstreamLoginSessionResult = {
  expiresAt: string;
  upstreamSessionToken: string;
};

type LoginUpstreamSessionResponse = {
  loginUpstreamSession: UpstreamLoginSessionResult;
};

const LOGIN_UPSTREAM_SESSION_MUTATION = `
  mutation LoginUpstreamSession($input: LoginUpstreamSessionInput!) {
    loginUpstreamSession(input: $input) {
      expiresAt
      upstreamSessionToken
    }
  }
`;

export async function requestUpstreamLoginSession(input: { password: string; userId: string }) {
  const response = await executeGraphQL<
    LoginUpstreamSessionResponse,
    OperationVariables & {
      input: {
        password: string;
        userId: string;
      };
    }
  >(LOGIN_UPSTREAM_SESSION_MUTATION, {
    input,
  });

  return response.loginUpstreamSession;
}
