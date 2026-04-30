import type { GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import { isExpiredUpstreamSessionError } from './upstream-error-feedback';

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
});
