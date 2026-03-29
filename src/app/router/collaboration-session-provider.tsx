import { type ReactNode, useMemo, useReducer } from 'react';
import { useLocation } from 'react-router';

import {
  type AppEnv,
  CollaborationSessionContext,
  type CollaborationSessionContextValue,
  type CollaborationSessionState,
  type EntryCard,
  type EntryMode,
  type SessionMessage,
} from './collaboration-session';
import {
  buildLocalEntryReply,
  getAvailableLocalEntryCards,
  matchLocalEntryCards,
} from './local-entry-catalog';

const MOCK_COLLABORATION_AVAILABILITY = 'unavailable' as const;
type AppRole = 'guest' | 'admin';

type CollaborationSessionAction =
  | { type: 'reset' }
  | {
      type: 'submit-query';
      payload: {
        cards?: EntryCard[];
        message: string;
        mode: EntryMode;
        systemReply?: string;
      };
    };

const INITIAL_SESSION_STATE: CollaborationSessionState = {
  availability: MOCK_COLLABORATION_AVAILABILITY,
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
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: `${role}-${randomSuffix}`,
    role,
    content,
    cards,
  };
}

function buildSystemReply(mode: EntryMode, systemReply?: string): string {
  if (systemReply) {
    return systemReply;
  }

  if (mode === 'local') {
    return '我先记下这个目标。下一步会优先按本地语义入口整理相关页面卡片。';
  }

  return '我先记下这个目标。下一步会结合上下文帮你整理页面、信息或草稿。';
}

function getCurrentRole(search: string): AppRole {
  return new URLSearchParams(search).get('role') === 'admin' ? 'admin' : 'guest';
}

function collaborationSessionReducer(
  state: CollaborationSessionState,
  action: CollaborationSessionAction,
): CollaborationSessionState {
  switch (action.type) {
    case 'reset':
      return INITIAL_SESSION_STATE;
    case 'submit-query': {
      const trimmedMessage = action.payload.message.trim();

      if (!trimmedMessage) {
        return state;
      }

      return {
        ...state,
        mode: action.payload.mode,
        status: 'ready',
        errorMessage: null,
        messages: [
          ...state.messages,
          createSessionMessage('user', trimmedMessage),
          createSessionMessage(
            'system',
            buildSystemReply(action.payload.mode, action.payload.systemReply),
            action.payload.cards,
          ),
        ],
      };
    }
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
  const [session, dispatch] = useReducer(collaborationSessionReducer, INITIAL_SESSION_STATE);
  const location = useLocation();

  const value = useMemo<CollaborationSessionContextValue>(
    () => ({
      session,
      resetSession: () => dispatch({ type: 'reset' }),
      submitQuery: (message) => {
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
          return;
        }

        const isUnavailable = session.availability === 'unavailable';
        const mode: EntryMode = isUnavailable ? 'local' : 'ai';
        const cards: EntryCard[] = isUnavailable
          ? matchLocalEntryCards(
              trimmedMessage,
              getAvailableLocalEntryCards({
                appEnv: currentAppEnv,
                role: getCurrentRole(location.search),
                search: location.search,
              }),
            )
          : [];

        dispatch({
          type: 'submit-query',
          payload: {
            message: trimmedMessage,
            cards,
            mode,
            systemReply: isUnavailable ? buildLocalEntryReply(trimmedMessage, cards) : undefined,
          },
        });
      },
    }),
    [currentAppEnv, location.search, session],
  );

  return (
    <CollaborationSessionContext.Provider value={value}>
      {children}
    </CollaborationSessionContext.Provider>
  );
}
