// src/features/ai-chat/infrastructure/ai-chat-error.ts

import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';

import { AiChatRequestError } from '../application/request-error';

export function toAiChatRequestError(
  error: unknown,
  input: { malformedResponseIsAmbiguous: boolean },
): AiChatRequestError {
  if (error instanceof AiChatRequestError) {
    return error;
  }

  if (hasGraphQLCategory(error, 'FORBIDDEN')) {
    return new AiChatRequestError({
      code: 'FORBIDDEN',
      message: 'AI chat request forbidden',
      retryDisposition: 'none',
      userMessage: '当前账号没有使用 AI 预览的权限。',
      cause: error,
    });
  }

  if (hasGraphQLCategory(error, 'BAD_USER_INPUT')) {
    return new AiChatRequestError({
      code: 'BAD_USER_INPUT',
      message: 'AI chat request rejected',
      retryDisposition: 'none',
      userMessage: '输入内容不符合要求，请修改后重试。',
      cause: error,
    });
  }

  if (isGraphQLIngressError(error) && error.type === 'auth') {
    return new AiChatRequestError({
      code: 'AUTH',
      message: 'AI chat authentication failed',
      retryDisposition: 'none',
      userMessage: error.userMessage,
      cause: error,
    });
  }

  const isInternalGraphQLError = hasGraphQLCategory(error, 'INTERNAL_SERVER_ERROR');
  const retryDisposition =
    isGraphQLIngressError(error) && error.type === 'malformed' && input.malformedResponseIsAmbiguous
      ? 'ambiguous'
      : isGraphQLIngressError(error) &&
          (error.isRetryable || error.type === 'malformed' || isInternalGraphQLError)
        ? 'retryable'
        : 'none';

  return new AiChatRequestError({
    code: 'UNAVAILABLE',
    message: 'AI chat request unavailable',
    retryDisposition,
    userMessage: 'AI 服务暂时无法处理这次请求，请稍后重试。',
    cause: error,
  });
}
