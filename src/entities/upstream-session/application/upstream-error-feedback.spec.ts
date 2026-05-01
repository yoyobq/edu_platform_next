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

  it('maps upstream staff scope mismatch to a user-facing teaching plan ownership message', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'UPSTREAM_STAFF_SCOPE_MISMATCH',
        }),
      ],
      message: 'UPSTREAM_STAFF_SCOPE_MISMATCH',
      type: 'graphql',
    });

    expect(resolveUpstreamErrorMessage(error, 'fallback')).toBe(
      '当前上游会话无法获取该教师的教学计划，或上游返回的计划负责人不匹配。',
    );
  });

  it('maps upstream session staff mismatch to a non-blocking ownership warning message', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'UPSTREAM_SESSION_STAFF_MISMATCH',
        }),
      ],
      message: 'UPSTREAM_SESSION_STAFF_MISMATCH',
      type: 'graphql',
    });

    expect(resolveUpstreamErrorMessage(error, 'fallback')).toBe(
      '当前校园网登录用户与查询教师不一致，本次按所选教师展示对账结果。',
    );
  });
});
