// src/app/providers/collaboration-session-provider.tsx

import { type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useLocation } from 'react-router';

import {
  buildLocalEntryReply,
  type EntryCard,
  getAvailableLocalEntryCards,
  matchLocalEntryCards,
  readCollaborationAvailability,
} from '@/app/lib';

import { AI_CHAT_INPUT_MAX_LENGTH, useAiChatSession } from '@/features/ai-chat';
import { useAuthSessionState } from '@/features/auth';

import { type AuthAccessGroup, hasAdminAccess } from '@/entities/auth-access';

import {
  type AppEnv,
  type CollaborationAvailability,
  CollaborationSessionContext,
  type CollaborationSessionContextValue,
  type CollaborationSessionState,
  type SessionMessage,
} from './collaboration-session';

const DEFAULT_COLLABORATION_AVAILABILITY = 'unavailable' as const;

type LocalSessionAction =
  | { type: 'reset' }
  | { type: 'reject-input'; payload: { systemReply: string } }
  | {
      type: 'submit-query';
      payload: {
        cards: EntryCard[];
        message: string;
        systemReply: string;
      };
    };

const INITIAL_LOCAL_SESSION_STATE: CollaborationSessionState = {
  availability: DEFAULT_COLLABORATION_AVAILABILITY,
  mode: 'local',
  status: 'idle',
  messages: [],
  errorMessage: null,
};

function createSessionMessage(
  role: SessionMessage['role'],
  content: string,
  cards?: EntryCard[],
): SessionMessage {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: `${role}-${randomSuffix}`,
    role,
    content,
    ...(cards ? { cards } : {}),
  };
}

function resolveCurrentAvailability(input: {
  currentAppEnv: AppEnv;
  hasAiPreviewAccess: boolean;
  search: string;
}): CollaborationAvailability {
  if (!input.hasAiPreviewAccess || input.currentAppEnv === 'prod') {
    return DEFAULT_COLLABORATION_AVAILABILITY;
  }

  const requestedAvailability = readCollaborationAvailability(input.search);

  if (requestedAvailability) {
    return requestedAvailability;
  }

  return input.currentAppEnv === 'dev' ? 'available' : DEFAULT_COLLABORATION_AVAILABILITY;
}

function localSessionReducer(
  state: CollaborationSessionState,
  action: LocalSessionAction,
): CollaborationSessionState {
  switch (action.type) {
    case 'reset':
      return INITIAL_LOCAL_SESSION_STATE;
    case 'reject-input':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload.systemReply,
        messages: [...state.messages, createSessionMessage('system', action.payload.systemReply)],
      };
    case 'submit-query':
      return {
        ...state,
        status: 'ready',
        errorMessage: null,
        messages: [
          ...state.messages,
          createSessionMessage('user', action.payload.message),
          createSessionMessage('system', action.payload.systemReply, action.payload.cards),
        ],
      };
    default:
      return state;
  }
}

type CollaborationSessionProviderProps = {
  children: ReactNode;
  currentAppEnv: AppEnv;
};

export function CollaborationSessionProvider({
  children,
  currentAppEnv,
}: CollaborationSessionProviderProps) {
  const [localSession, dispatchLocalSession] = useReducer(
    localSessionReducer,
    INITIAL_LOCAL_SESSION_STATE,
  );
  const location = useLocation();
  const authSession = useAuthSessionState();
  const activeSnapshot = authSession.status === 'authenticated' ? authSession.snapshot : null;
  const hasAiPreviewAccess = activeSnapshot
    ? hasAdminAccess({ accessGroup: activeSnapshot.userInfo.accessGroup })
    : false;
  const aiChatEnabled = hasAiPreviewAccess && currentAppEnv !== 'prod';
  const currentAvailability = resolveCurrentAvailability({
    currentAppEnv,
    hasAiPreviewAccess,
    search: location.search,
  });
  const {
    reset: resetAiChat,
    state: aiChatState,
    submit: submitAiChat,
  } = useAiChatSession({
    accountId: activeSnapshot?.accountId,
    enabled: aiChatEnabled,
  });
  const usesAiChat = currentAvailability === 'available';
  const aiMessages = useMemo<SessionMessage[]>(
    () =>
      aiChatState.messages.map((message) => ({
        content: message.content,
        id: message.id,
        role: message.role === 'assistant' ? 'system' : 'user',
        status: message.status,
      })),
    [aiChatState.messages],
  );
  const projectedMessages = useMemo(
    () =>
      usesAiChat
        ? [...localSession.messages, ...aiMessages]
        : [...aiMessages, ...localSession.messages],
    [aiMessages, localSession.messages, usesAiChat],
  );

  useEffect(() => {
    dispatchLocalSession({ type: 'reset' });
  }, [activeSnapshot?.accountId]);

  const resetSession = useCallback(() => {
    resetAiChat();
    dispatchLocalSession({ type: 'reset' });
  }, [resetAiChat]);

  const submitQuery = useCallback(
    (message: string): boolean => {
      const trimmedMessage = message.trim();

      if (!trimmedMessage || currentAvailability === 'readonly') {
        return false;
      }

      if (usesAiChat) {
        return submitAiChat(trimmedMessage);
      }

      if (trimmedMessage.length > AI_CHAT_INPUT_MAX_LENGTH) {
        dispatchLocalSession({
          type: 'reject-input',
          payload: { systemReply: '单条消息不能超过 12000 个字符。' },
        });
        return false;
      }

      const cards = matchLocalEntryCards(
        trimmedMessage,
        getAvailableLocalEntryCards({
          accountId: activeSnapshot?.accountId,
          appEnv: currentAppEnv,
          primaryAccessGroup: activeSnapshot?.primaryAccessGroup ?? ('GUEST' as AuthAccessGroup),
          accessGroup: activeSnapshot?.userInfo.accessGroup ?? ['GUEST'],
          slotGroup: activeSnapshot?.slotGroup ?? [],
          search: location.search,
        }),
      );

      dispatchLocalSession({
        type: 'submit-query',
        payload: {
          message: trimmedMessage,
          cards,
          systemReply: buildLocalEntryReply(trimmedMessage, cards),
        },
      });
      return true;
    },
    [activeSnapshot, currentAppEnv, currentAvailability, location.search, submitAiChat, usesAiChat],
  );

  const value = useMemo<CollaborationSessionContextValue>(
    () => ({
      session: usesAiChat
        ? {
            availability: currentAvailability,
            mode: 'ai',
            status: aiChatState.status,
            messages: projectedMessages,
            errorMessage: aiChatState.errorMessage,
          }
        : {
            ...localSession,
            availability: currentAvailability,
            messages: projectedMessages,
          },
      resetSession,
      submitQuery,
    }),
    [
      aiChatState.errorMessage,
      aiChatState.status,
      currentAvailability,
      localSession,
      projectedMessages,
      resetSession,
      submitQuery,
      usesAiChat,
    ],
  );

  return (
    <CollaborationSessionContext.Provider value={value}>
      {children}
    </CollaborationSessionContext.Provider>
  );
}
