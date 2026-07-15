// src/features/ai-chat/ui/use-ai-chat-session.ts

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type {
  AiChatSessionMessage,
  AiChatSessionState,
  PendingAiChatTurn,
} from '../application/types';
import {
  AI_CHAT_INPUT_MAX_LENGTH,
  AI_CHAT_QUERY_RETRY_DELAY_MS,
  resolveAiChatAdmissionPresentation,
  resolveAiChatPollDelay,
  resolveAiChatRequestErrorMessage,
  resolveAiChatWorkflowPresentation,
  shouldRetryAiChatQuery,
} from '../application/workflow';
import { queryAiChatTurn, queueAiChatTurn } from '../infrastructure/ai-chat-api';
import {
  clearPendingAiChatTurn,
  loadPendingAiChatTurn,
  savePendingAiChatTurn,
} from '../infrastructure/pending-turn-storage';

type AiChatSessionAction =
  | { type: 'reset' }
  | { type: 'reject-input'; payload: { content: string } }
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

const INITIAL_AI_CHAT_SESSION_STATE: AiChatSessionState = {
  errorMessage: null,
  messages: [],
  status: 'idle',
};

function createRandomId(prefix: string): string {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomSuffix}`;
}

function createMessage(
  role: AiChatSessionMessage['role'],
  content: string,
  options: { id?: string; status?: AiChatSessionMessage['status'] } = {},
): AiChatSessionMessage {
  return {
    content,
    id: options.id ?? createRandomId(role),
    role,
    ...(options.status ? { status: options.status } : {}),
  };
}

function aiChatSessionReducer(
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
        messages: [...state.messages, createMessage('assistant', action.payload.content)],
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
          createMessage('assistant', '正在恢复上次未完成的 Qwen 任务。', {
            id: action.payload.assistantMessageId,
            status: 'waiting',
          }),
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

export function useAiChatSession(input: { accountId?: number; enabled: boolean }) {
  const [state, dispatch] = useReducer(aiChatSessionReducer, INITIAL_AI_CHAT_SESSION_STATE);
  const pollTimerRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const activeTurnRef = useRef<PendingAiChatTurn | null>(null);
  const isSubmittingRef = useRef(false);
  const requestEpochRef = useRef(0);
  const pollTurnRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const discardedAdmissionEpochsRef = useRef(new Set<number>());

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const stopActiveTurn = useCallback(
    (options: { clearStorage?: boolean } = {}) => {
      const activeTurn = activeTurnRef.current;

      requestEpochRef.current += 1;
      clearPollTimer();
      activeTurnRef.current = null;
      pollInFlightRef.current = false;
      isSubmittingRef.current = false;

      if (activeTurn && options.clearStorage) {
        clearPendingAiChatTurn(activeTurn.accountId);
      }
    },
    [clearPollTimer],
  );

  const finishActiveTurn = useCallback(
    (input: {
      assistantMessageId: string;
      content: string;
      status: NonNullable<AiChatSessionMessage['status']>;
      workflowId: string;
    }) => {
      const activeTurn = activeTurnRef.current;

      if (!activeTurn || activeTurn.workflowId !== input.workflowId) {
        return;
      }

      dispatch({
        type: 'update',
        payload: {
          assistantMessageId: input.assistantMessageId,
          content: input.content,
          sessionStatus: input.status === 'completed' ? 'ready' : 'error',
          turnStatus: input.status,
        },
      });
      clearPendingAiChatTurn(activeTurn.accountId);
      stopActiveTurn();
    },
    [stopActiveTurn],
  );

  const pauseActiveTurn = useCallback(
    (input: { assistantMessageId: string; content: string; workflowId: string }) => {
      const activeTurn = activeTurnRef.current;

      if (!activeTurn || activeTurn.workflowId !== input.workflowId) {
        return;
      }

      clearPollTimer();
      dispatch({
        type: 'update',
        payload: {
          assistantMessageId: input.assistantMessageId,
          content: `${input.content} 已保留任务恢复信息，可刷新页面后重试查询，或停止等待。`,
          sessionStatus: 'loading',
          turnStatus: 'waiting_for_service',
        },
      });
    },
    [clearPollTimer],
  );

  const schedulePoll = useCallback(
    (delayMs: number) => {
      clearPollTimer();
      pollTimerRef.current = window.setTimeout(() => {
        pollTimerRef.current = null;
        void pollTurnRef.current();
      }, delayMs);
    },
    [clearPollTimer],
  );

  const pollTurn = useCallback(async () => {
    const activeTurn = activeTurnRef.current;

    if (!activeTurn || pollInFlightRef.current || document.visibilityState === 'hidden') {
      return;
    }

    pollInFlightRef.current = true;

    try {
      const result = await queryAiChatTurn(activeTurn.workflowId);

      if (activeTurnRef.current?.workflowId !== activeTurn.workflowId) {
        return;
      }

      if (!result) {
        finishActiveTurn({
          assistantMessageId: activeTurn.assistantMessageId,
          content: '没有找到这次 AI 任务，任务可能已过期，请重新发送。',
          status: 'failed',
          workflowId: activeTurn.workflowId,
        });
        return;
      }

      const presentation = resolveAiChatWorkflowPresentation(result);

      if (presentation.terminal) {
        finishActiveTurn({
          assistantMessageId: activeTurn.assistantMessageId,
          content: presentation.content,
          status: presentation.status,
          workflowId: activeTurn.workflowId,
        });
        return;
      }

      dispatch({
        type: 'update',
        payload: {
          assistantMessageId: activeTurn.assistantMessageId,
          content: presentation.content,
          sessionStatus: 'loading',
          turnStatus: presentation.status,
        },
      });
      schedulePoll(
        resolveAiChatPollDelay({
          elapsedMs: Date.now() - activeTurn.startedAt,
          status: presentation.status,
        }),
      );
    } catch (error) {
      if (activeTurnRef.current?.workflowId !== activeTurn.workflowId) {
        return;
      }

      if (shouldRetryAiChatQuery(error)) {
        dispatch({
          type: 'update',
          payload: {
            assistantMessageId: activeTurn.assistantMessageId,
            content: '状态查询暂时中断，任务仍可能在后台运行，正在继续查询。',
            sessionStatus: 'loading',
            turnStatus: 'waiting_for_service',
          },
        });
        schedulePoll(AI_CHAT_QUERY_RETRY_DELAY_MS);
        return;
      }

      pauseActiveTurn({
        assistantMessageId: activeTurn.assistantMessageId,
        content: resolveAiChatRequestErrorMessage(error),
        workflowId: activeTurn.workflowId,
      });
    } finally {
      pollInFlightRef.current = false;
    }
  }, [finishActiveTurn, pauseActiveTurn, schedulePoll]);

  useEffect(() => {
    pollTurnRef.current = pollTurn;
  }, [pollTurn]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeTurnRef.current) {
        clearPollTimer();
        void pollTurnRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearPollTimer]);

  useEffect(() => {
    stopActiveTurn();
    dispatch({ type: 'reset' });

    if (!input.accountId || !input.enabled) {
      return () => {
        stopActiveTurn();
      };
    }

    const pendingTurn = loadPendingAiChatTurn(input.accountId);

    if (pendingTurn) {
      activeTurnRef.current = pendingTurn;
      isSubmittingRef.current = true;
      dispatch({ type: 'recover', payload: pendingTurn });
      void pollTurnRef.current();
    }

    return () => {
      stopActiveTurn();
    };
  }, [input.accountId, input.enabled, stopActiveTurn]);

  const submit = useCallback(
    (message: string): boolean => {
      const trimmedMessage = message.trim();
      const accountId = input.accountId;

      if (!input.enabled || !accountId || !trimmedMessage || isSubmittingRef.current) {
        return false;
      }

      if (trimmedMessage.length > AI_CHAT_INPUT_MAX_LENGTH) {
        dispatch({
          type: 'reject-input',
          payload: { content: '单条消息不能超过 12000 个字符。' },
        });
        return false;
      }

      isSubmittingRef.current = true;
      const requestEpoch = requestEpochRef.current;
      const userMessageId = createRandomId('user');
      const assistantMessageId = createRandomId('assistant');
      const requestId = createRandomId('request');
      const traceId = createRandomId('trace');
      const startedAt = Date.now();

      dispatch({
        type: 'start',
        payload: {
          assistantMessageId,
          message: trimmedMessage,
          userMessageId,
        },
      });

      void (async () => {
        try {
          const enqueueResult = await queueAiChatTurn({
            message: trimmedMessage,
            requestId,
            traceId,
          });
          const presentation = resolveAiChatAdmissionPresentation(enqueueResult);

          if (requestEpochRef.current !== requestEpoch) {
            const wasExplicitlyDiscarded = discardedAdmissionEpochsRef.current.delete(requestEpoch);

            if (!wasExplicitlyDiscarded && !presentation.terminal) {
              savePendingAiChatTurn({
                accountId,
                assistantMessageId,
                startedAt,
                userMessage: trimmedMessage,
                userMessageId,
                workflowId: enqueueResult.workflowId,
              });
            }
            return;
          }

          discardedAdmissionEpochsRef.current.delete(requestEpoch);

          if (presentation.terminal) {
            dispatch({
              type: 'update',
              payload: {
                assistantMessageId,
                content: presentation.content,
                sessionStatus: 'error',
                turnStatus: presentation.status,
              },
            });
            isSubmittingRef.current = false;
            return;
          }

          const pendingTurn: PendingAiChatTurn = {
            accountId,
            assistantMessageId,
            startedAt,
            userMessage: trimmedMessage,
            userMessageId,
            workflowId: enqueueResult.workflowId,
          };

          activeTurnRef.current = pendingTurn;
          savePendingAiChatTurn(pendingTurn);
          dispatch({
            type: 'update',
            payload: {
              assistantMessageId,
              content: presentation.content,
              sessionStatus: 'loading',
              turnStatus: presentation.status,
            },
          });
          void pollTurnRef.current();
        } catch (error) {
          discardedAdmissionEpochsRef.current.delete(requestEpoch);

          if (requestEpochRef.current !== requestEpoch) {
            return;
          }

          dispatch({
            type: 'update',
            payload: {
              assistantMessageId,
              content: resolveAiChatRequestErrorMessage(error),
              sessionStatus: 'error',
              turnStatus: 'failed',
            },
          });
          isSubmittingRef.current = false;
        }
      })();

      return true;
    },
    [input.accountId, input.enabled],
  );

  const reset = useCallback(() => {
    if (isSubmittingRef.current && !activeTurnRef.current) {
      discardedAdmissionEpochsRef.current.add(requestEpochRef.current);
    }

    stopActiveTurn({ clearStorage: true });
    dispatch({ type: 'reset' });
  }, [stopActiveTurn]);

  return { reset, state, submit };
}
