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

type CreateVerificationRecordResponse = {
  createVerificationRecord: {
    message?: string | null;
    success: boolean;
    token?: string | null;
  };
};

type QueueEmailResponse = {
  queueEmail: {
    queued: boolean;
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

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const CREATE_PASSWORD_RESET_RECORD_MUTATION = `
  mutation CreatePasswordResetVerificationRecord($input: CreateVerificationRecordInput!) {
    createVerificationRecord(input: $input) {
      message
      success
      token
    }
  }
`;

const QUEUE_PASSWORD_RESET_EMAIL_MUTATION = `
  mutation QueuePasswordResetEmail($input: QueueEmailInput!) {
    queueEmail(input: $input) {
      queued
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

function buildPasswordResetLink(token: string) {
  if (typeof window === 'undefined') {
    return `/reset-password/${encodeURIComponent(token)}`;
  }

  return `${window.location.origin}/reset-password/${encodeURIComponent(token)}`;
}

function buildPasswordResetEmailText(link: string) {
  return [
    '你正在申请重置密码。',
    '如果这不是你的操作，请忽略这封邮件。',
    '',
    `请打开以下链接继续重置密码：${link}`,
  ].join('\n');
}

async function createPasswordResetVerificationRecord(email: string) {
  const response = await requestGraphQL<
    CreateVerificationRecordResponse,
    {
      input: {
        expiresAt: string;
        payload: { email: string };
        returnToken: boolean;
        type: 'PASSWORD_RESET';
      };
    }
  >(CREATE_PASSWORD_RESET_RECORD_MUTATION, {
    input: {
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
      payload: {
        email,
      },
      returnToken: true,
      type: 'PASSWORD_RESET',
    },
  });

  if (!response.createVerificationRecord.success || !response.createVerificationRecord.token) {
    throw new Error(response.createVerificationRecord.message || '暂时无法创建重置链接。');
  }

  return response.createVerificationRecord.token;
}

async function queuePasswordResetEmail(email: string, token: string) {
  const response = await requestGraphQL<
    QueueEmailResponse,
    {
      input: {
        subject: string;
        text: string;
        to: string;
      };
    }
  >(QUEUE_PASSWORD_RESET_EMAIL_MUTATION, {
    input: {
      subject: '密码重置',
      text: buildPasswordResetEmailText(buildPasswordResetLink(token)),
      to: email,
    },
  });

  if (!response.queueEmail.queued) {
    throw new Error('暂时无法发送重置邮件。');
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
    const token = await createPasswordResetVerificationRecord(input.email);

    await queuePasswordResetEmail(input.email, token);
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
