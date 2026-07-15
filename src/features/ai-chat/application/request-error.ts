// src/features/ai-chat/application/request-error.ts

export type AiChatRequestErrorCode = 'AUTH' | 'BAD_USER_INPUT' | 'FORBIDDEN' | 'UNAVAILABLE';
export type AiChatRequestRetryDisposition = 'ambiguous' | 'none' | 'retryable';

export class AiChatRequestError extends Error {
  readonly code: AiChatRequestErrorCode;
  readonly retryDisposition: AiChatRequestRetryDisposition;
  readonly userMessage: string;

  constructor(input: {
    code: AiChatRequestErrorCode;
    message: string;
    retryDisposition: AiChatRequestRetryDisposition;
    userMessage: string;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = 'AiChatRequestError';
    this.code = input.code;
    this.retryDisposition = input.retryDisposition;
    this.userMessage = input.userMessage;
  }
}

export function isAiChatRequestError(error: unknown): error is AiChatRequestError {
  return error instanceof AiChatRequestError;
}
