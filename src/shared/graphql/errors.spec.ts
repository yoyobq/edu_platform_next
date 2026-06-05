// src/shared/graphql/errors.spec.ts

import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { GraphQLIngressError, hasGraphQLErrorCode, toGraphQLIngressError } from './errors';

function buildCombinedGraphQLError(
  extensions: Record<string, unknown>,
  message = String(extensions.errorCode || extensions.code || 'error'),
) {
  const error: GraphQLFormattedError = {
    extensions,
    message,
  };

  return new CombinedGraphQLErrors({
    errors: [error],
  });
}

describe('GraphQL ingress errors', () => {
  it('classifies refresh token failures by UNAUTHENTICATED code', () => {
    const error = toGraphQLIngressError(
      buildCombinedGraphQLError({
        code: 'UNAUTHENTICATED',
        errorCode: 'INVALID_REFRESH_TOKEN',
      }),
      { operationName: 'Refresh' },
    );

    expect(error.type).toBe('auth');
    expect(error.operationName).toBe('Refresh');
  });

  it('keeps input normalization errors as GraphQL execution failures', () => {
    const error = toGraphQLIngressError(
      buildCombinedGraphQLError({
        code: 'BAD_USER_INPUT',
        errorCode: 'INPUT_NORMALIZE_DEPARTMENT_ID_REQUIRED',
      }),
      { operationName: 'DryRunSyncClassesFromUpstream' },
    );

    expect(error.type).toBe('graphql');
    expect(error.userMessage).toBe('请求处理失败，请稍后重试。');
  });

  it('matches GraphQL extension code and errorCode values', () => {
    const error = new GraphQLIngressError({
      type: 'graphql',
      message: '请求处理失败',
      graphqlErrors: [
        {
          message: '请求处理失败',
          extensions: {
            code: 'BAD_USER_INPUT',
            errorCode: 'STUDENT_REGISTRATION_IDENTITY_MISMATCH',
          },
        },
      ],
    });

    expect(hasGraphQLErrorCode(error, 'BAD_USER_INPUT')).toBe(true);
    expect(hasGraphQLErrorCode(error, 'STUDENT_REGISTRATION_IDENTITY_MISMATCH')).toBe(true);
    expect(hasGraphQLErrorCode(error, 'AUTH_LOGIN_EMAIL_NOT_VERIFIED')).toBe(false);
    expect(hasGraphQLErrorCode(new Error('plain'), 'BAD_USER_INPUT')).toBe(false);
  });
});
