import type { PublicAuthApiPort } from '../application/ports';
import type { ResetPasswordResult, VerificationIntentResult } from '../application/types';

import { mapVerificationRecordToIntentResult } from './mapper';
import { resolveVerificationFailureReason } from './resolve-verification-failure-reason';

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{
    message?: string;
  }>;
};

type RequestPasswordResetEmailResponse = {
  requestPasswordResetEmail: {
    message?: string | null;
    success: boolean;
  };
};

type FindVerificationRecordResponse = {
  findVerificationRecord: {
    notBefore?: string | null;
    status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  } | null;
};

type ResetPasswordResponse = {
  resetPassword: {
    message?: string | null;
    success: boolean;
  };
};

const REQUEST_PASSWORD_RESET_EMAIL_MUTATION = `
  mutation RequestPasswordResetEmail($input: RequestPasswordResetEmailInput!) {
    requestPasswordResetEmail(input: $input) {
      message
      success
    }
  }
`;

const FIND_PASSWORD_RESET_RECORD_QUERY = `
  query FindPasswordResetVerificationRecord($input: FindVerificationRecordInput!) {
    findVerificationRecord(input: $input) {
      notBefore
      status
    }
  }
`;

const RESET_PASSWORD_MUTATION = `
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      message
      success
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
    throw new Error(payload.errors?.[0]?.message || `请求失败（HTTP ${response.status}）。`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'GraphQL 请求失败。');
  }

  if (!payload.data) {
    throw new Error('GraphQL 未返回 data。');
  }

  return payload.data;
}

async function requestPasswordResetEmail(email: string) {
  const response = await requestGraphQL<
    RequestPasswordResetEmailResponse,
    {
      input: {
        email: string;
      };
    }
  >(REQUEST_PASSWORD_RESET_EMAIL_MUTATION, {
    input: {
      email,
    },
  });

  if (!response.requestPasswordResetEmail.success) {
    throw new Error(response.requestPasswordResetEmail.message || '暂时无法发送重置邮件。');
  }
}

async function findResetPasswordIntent(
  verificationCode: string,
): Promise<VerificationIntentResult> {
  const response = await requestGraphQL<
    FindVerificationRecordResponse,
    {
      input: {
        expectedType: 'PASSWORD_RESET';
        ignoreTargetRestriction: boolean;
        token: string;
      };
    }
  >(FIND_PASSWORD_RESET_RECORD_QUERY, {
    input: {
      expectedType: 'PASSWORD_RESET',
      ignoreTargetRestriction: true,
      token: verificationCode,
    },
  });

  if (!response.findVerificationRecord) {
    return {
      status: 'invalid',
      reason: 'invalid',
    };
  }

  return mapVerificationRecordToIntentResult(response.findVerificationRecord);
}

export const publicAuthApi: PublicAuthApiPort = {
  async requestPasswordReset(input) {
    await requestPasswordResetEmail(input.email);
  },
  async resetPassword(input) {
    try {
      const response = await requestGraphQL<
        ResetPasswordResponse,
        {
          input: {
            newPassword: string;
            token: string;
          };
        }
      >(RESET_PASSWORD_MUTATION, {
        input: {
          newPassword: input.newPassword,
          token: input.verificationCode,
        },
      });

      if (response.resetPassword.success) {
        return { status: 'success' };
      }

      return toResetPasswordResult(
        new Error(response.resetPassword.message || '暂时无法完成密码重置。'),
      );
    } catch (error) {
      return toResetPasswordResult(error);
    }
  },
  async verifyResetPasswordIntent(input) {
    return findResetPasswordIntent(input.verificationCode);
  },
};

function toResetPasswordResult(error: unknown): ResetPasswordResult {
  const reason = resolveVerificationFailureReason(error);

  if (reason !== 'unknown') {
    return {
      status: 'failure',
      reason,
    };
  }

  return {
    status: 'error',
    message: error instanceof Error ? error.message : '暂时无法完成密码重置。',
  };
}
