// src/features/ai-chat/application/session-state.ts

import type { AiChatSessionMessage, AiChatSessionState, PendingAiChatTurn } from './types';

export type AiChatSessionAction =
  | { type: 'reset' }
  | {
      type: 'reject-input';
      payload: { assistantMessageId: string; content: string };
    }
  | {
      type: 'start';
      payload: {
        assistantMessageId: string;
        message: string;
        userMessageId: string;
      };
    }
  | { type: 'recover'; payload: PendingAiChatTurn }
  | {
      type: 'update';
      payload: {
        assistantMessageId: string;
        content: string;
        sessionStatus: AiChatSessionState['status'];
        turnStatus: NonNullable<AiChatSessionMessage['status']>;
      };
    };

export const INITIAL_AI_CHAT_SESSION_STATE: AiChatSessionState = {
  errorMessage: null,
  messages: [],
  status: 'idle',
};

function createMessage(
  role: AiChatSessionMessage['role'],
  content: string,
  options: { id: string; status?: AiChatSessionMessage['status'] },
): AiChatSessionMessage {
  return {
    content,
    id: options.id,
    role,
    ...(options.status ? { status: options.status } : {}),
  };
}

export function reduceAiChatSessionState(
  state: AiChatSessionState,
  action: AiChatSessionAction,
): AiChatSessionState {
  switch (action.type) {
    case 'reset':
      return INITIAL_AI_CHAT_SESSION_STATE;
    case 'reject-input':
      return {
        ...state,
        errorMessage: action.payload.content,
        messages: [
          ...state.messages,
          createMessage('assistant', action.payload.content, {
            id: action.payload.assistantMessageId,
          }),
        ],
        status: 'error',
      };
    case 'start':
      return {
        errorMessage: null,
        messages: [
          ...state.messages,
          createMessage('user', action.payload.message, { id: action.payload.userMessageId }),
          createMessage('assistant', '正在提交到 Qwen 异步工作流。', {
            id: action.payload.assistantMessageId,
            status: 'waiting',
          }),
        ],
        status: 'loading',
      };
    case 'recover':
      return {
        errorMessage: null,
        messages: [
          createMessage('user', action.payload.userMessage, {
            id: action.payload.userMessageId,
          }),
          createMessage(
            'assistant',
            action.payload.phase === 'admission'
              ? '正在恢复上次未确认的 Qwen 提交。'
              : '正在恢复上次未完成的 Qwen 任务。',
            {
              id: action.payload.assistantMessageId,
              status: 'waiting',
            },
          ),
        ],
        status: 'loading',
      };
    case 'update': {
      const isError = action.payload.sessionStatus === 'error';

      return {
        errorMessage: isError ? action.payload.content : null,
        messages: state.messages.map((message) =>
          message.id === action.payload.assistantMessageId
            ? {
                ...message,
                content: action.payload.content,
                status: action.payload.turnStatus,
              }
            : message,
        ),
        status: action.payload.sessionStatus,
      };
    }
    default:
      return state;
  }
}
