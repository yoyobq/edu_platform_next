// src/app/providers/collaboration-session-provider.tsx

import { type ReactNode, useMemo, useReducer } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  buildLocalEntryReply,
  type EntryCard,
  getAvailableLocalEntryCards,
  matchLocalEntryCards,
} from '@/app/lib';

import { useAuthSessionState } from '@/features/auth';

import {
  resolveThirdWorkspaceDemoTrigger,
  THIRD_WORKSPACE_DEMO_TRIGGER,
  withThirdWorkspaceDemo,
} from '@/shared/third-workspace-demo';

import {
  type AppEnv,
  type CollaborationAvailability,
  CollaborationSessionContext,
  type CollaborationSessionContextValue,
  type CollaborationSessionState,
  type EntryMode,
  type SessionMessage,
} from './collaboration-session';

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

function getCurrentRoleFromSession(role: string | undefined): AppRole {
  return role === 'ADMIN' ? 'admin' : 'guest';
}

function getCurrentAvailability(search: string): CollaborationAvailability {
  const value = new URLSearchParams(search).get('availability');

  if (
    value === 'available' ||
    value === 'degraded' ||
    value === 'readonly' ||
    value === 'unavailable'
  ) {
    return value;
  }

  return MOCK_COLLABORATION_AVAILABILITY;
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
  const navigate = useNavigate();
  const authSession = useAuthSessionState();
  const currentAvailability = getCurrentAvailability(location.search);

  const value = useMemo<CollaborationSessionContextValue>(
    () => ({
      session: {
        ...session,
        availability: currentAvailability,
      },
      resetSession: () => dispatch({ type: 'reset' }),
      submitQuery: (message) => {
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
          return;
        }

        if (currentAvailability === 'readonly') {
          return;
        }

        const matchedWorkspaceArtifact =
          location.pathname === '/' ? resolveThirdWorkspaceDemoTrigger(trimmedMessage) : null;

        if (matchedWorkspaceArtifact) {
          navigate(
            {
              pathname: location.pathname,
              search: withThirdWorkspaceDemo(location.search, matchedWorkspaceArtifact.id),
            },
            { replace: false },
          );

          dispatch({
            type: 'submit-query',
            payload: {
              message: trimmedMessage,
              cards: [],
              mode: 'local',
              systemReply: `已按 demo 验证触发词“${THIRD_WORKSPACE_DEMO_TRIGGER}”为你打开第三工作区 demo。这条链路只用于跳层验证，不代表正式默认入口能力。`,
            },
          });
          return;
        }

        const prefersLocalEntry =
          currentAvailability === 'unavailable' || currentAvailability === 'degraded';
        const mode: EntryMode = prefersLocalEntry ? 'local' : 'ai';
        const cards: EntryCard[] = prefersLocalEntry
          ? matchLocalEntryCards(
              trimmedMessage,
              getAvailableLocalEntryCards({
                appEnv: currentAppEnv,
                role: getCurrentRoleFromSession(authSession.snapshot?.role),
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
            systemReply: prefersLocalEntry
              ? buildLocalEntryReply(trimmedMessage, cards)
              : undefined,
          },
        });
      },
    }),
    [
      authSession.snapshot?.role,
      currentAppEnv,
      currentAvailability,
      location.pathname,
      location.search,
      navigate,
      session,
    ],
  );

  return (
    <CollaborationSessionContext.Provider value={value}>
      {children}
    </CollaborationSessionContext.Provider>
  );
}
