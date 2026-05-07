import type { GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from './upstream-error-feedback';

function buildGraphQLError(extensions: Record<string, unknown>): GraphQLFormattedError {
  return {
    extensions,
    message: String(extensions.errorMessage || extensions.errorCode || extensions.code || 'error'),
  };
}

describe('upstream error feedback', () => {
  it('treats UPSTREAM_ACCESS_AUTH_REQUIRED errorCode as an expired upstream session', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'UPSTREAM_ACCESS_AUTH_REQUIRED',
        }),
      ],
      message: 'UPSTREAM_ACCESS_AUTH_REQUIRED',
      type: 'graphql',
    });

    expect(isExpiredUpstreamSessionError(error)).toBe(true);
  });

  it('treats UPSTREAM_ACCESS_AUTH_REQUIRED code as an expired upstream session', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          code: 'UPSTREAM_ACCESS_AUTH_REQUIRED',
        }),
      ],
      message: 'UPSTREAM_ACCESS_AUTH_REQUIRED',
      type: 'graphql',
    });

    expect(isExpiredUpstreamSessionError(error)).toBe(true);
  });

  it('treats auth ingress errors as expired upstream sessions', () => {
    const error = new GraphQLIngressError({
      message: 'Unauthorized',
      statusCode: 401,
      type: 'auth',
    });

    expect(isExpiredUpstreamSessionError(error)).toBe(true);
  });

  it('uses readable GraphQL error messages when present', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorMessage: '上游返回了可读错误。',
        }),
      ],
      message: 'error',
      type: 'graphql',
    });

    expect(resolveUpstreamErrorMessage(error, 'fallback')).toBe('上游返回了可读错误。');
  });

  it('does not own feature-specific symbolic issue messages', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT',
        }),
      ],
      message: 'INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT',
      type: 'graphql',
    });

    expect(resolveUpstreamErrorMessage(error, 'fallback')).not.toContain('一体化计划明细');
  });
});
