// src/features/ai-chat/infrastructure/ai-chat-error.spec.ts

import type { GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import { toAiChatRequestError } from './ai-chat-error';

function buildGraphQLIngressError(code: string): GraphQLIngressError {
  const graphqlError: GraphQLFormattedError = {
    message: code,
    extensions: { code },
  };

  return new GraphQLIngressError({
    type: 'graphql',
    message: code,
    graphqlErrors: [graphqlError],
  });
}

describe('ai chat error translation', () => {
  it('treats INTERNAL_SERVER_ERROR as a retryable unavailable request', () => {
    const error = toAiChatRequestError(buildGraphQLIngressError('INTERNAL_SERVER_ERROR'), {
      malformedResponseIsAmbiguous: false,
    });

    expect(error).toMatchObject({
      code: 'UNAVAILABLE',
      retryDisposition: 'retryable',
    });
  });

  it('keeps BAD_USER_INPUT non-retryable', () => {
    const error = toAiChatRequestError(buildGraphQLIngressError('BAD_USER_INPUT'), {
      malformedResponseIsAmbiguous: false,
    });

    expect(error).toMatchObject({
      code: 'BAD_USER_INPUT',
      retryDisposition: 'none',
    });
  });
});
