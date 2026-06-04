// src/features/student-roster-membership-reconciliation/infrastructure/api-errors.spec.ts

import { describe, expect, it } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import { isRosterMembershipPermissionError } from './api-errors';

describe('student roster membership api errors', () => {
  it('matches insufficient permissions GraphQL errors', () => {
    expect(
      isRosterMembershipPermissionError(
        new GraphQLIngressError({
          type: 'graphql',
          message: '无权处理该班学生名单归属',
          graphqlErrors: [
            {
              message: '无权处理该班学生名单归属',
              extensions: {
                code: 'FORBIDDEN',
                errorCode: 'INSUFFICIENT_PERMISSIONS',
              },
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('does not match other GraphQL or auth errors', () => {
    expect(
      isRosterMembershipPermissionError(
        new GraphQLIngressError({
          type: 'graphql',
          message: '请求处理失败',
          graphqlErrors: [
            {
              message: '请求处理失败',
              extensions: {
                code: 'BAD_USER_INPUT',
                errorCode: 'INPUT_INVALID',
              },
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isRosterMembershipPermissionError(
        new GraphQLIngressError({
          type: 'auth',
          message: 'TOKEN_INVALID',
        }),
      ),
    ).toBe(false);
  });
});
