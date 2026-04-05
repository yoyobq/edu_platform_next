import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type { PublicAuthApiPort } from '../application/ports';
import type { ResetPasswordResult, VerificationIntentResult } from '../application/types';

import { mapVerificationRecordToIntentResult } from './mapper';
import {
  mapVerificationFailureReason,
  resolveVerificationFailureReason,
} from './resolve-verification-failure-reason';

type RequestPasswordResetEmailResponse = {
  requestPasswordResetEmail: {
    message?: string | null;
    success: boolean;
  };
};

type VerificationRecordFailureReason = 'EXPIRED' | 'INVALID' | 'USED';

type FindVerificationRecordResponse = {
  findVerificationRecord: {
    message?: string | null;
    reason?: VerificationRecordFailureReason | null;
    record?: {
      notBefore?: string | null;
      status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
    } | null;
    success: boolean;
  };
};

type ResetPasswordResponse = {
  resetPassword: {
    message?: string | null;
    reason?: VerificationRecordFailureReason | null;
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
      message
      reason
      success
      record {
        notBefore
        status
      }
    }
  }
`;

const RESET_PASSWORD_MUTATION = `
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      message
      reason
      success
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables, {
    authMode: 'none',
  });
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

  const result = response.findVerificationRecord;

  if (result.success && result.record) {
    return mapVerificationRecordToIntentResult(result.record);
  }

  const reason = mapVerificationFailureReason(result.reason);

  if (reason === 'expired') {
    return {
      status: 'expired',
      reason,
    };
  }

  if (reason === 'used') {
    return {
      status: 'used',
      reason,
    };
  }

  if (reason === 'invalid') {
    return {
      status: 'invalid',
      reason,
    };
  }

  throw new Error(result.message || '暂时无法确认重置链接状态。');
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

      const reason = mapVerificationFailureReason(response.resetPassword.reason);

      if (reason !== 'unknown') {
        return {
          status: 'failure',
          reason,
        };
      }

      return {
        status: 'error',
        message: response.resetPassword.message || '暂时无法完成密码重置。',
      };
    } catch (error) {
      return toResetPasswordResult(error);
    }
  },
  async verifyResetPasswordIntent(input) {
    return findResetPasswordIntent(input.verificationCode);
  },
};

function toResetPasswordResult(error: unknown): ResetPasswordResult {
  if (isGraphQLIngressError(error)) {
    return {
      status: 'error',
      message: error.userMessage,
    };
  }

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
