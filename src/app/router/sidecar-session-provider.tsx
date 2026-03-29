import { type ReactNode, useMemo, useReducer } from 'react';

import {
  type EntryMode,
  type SessionMessage,
  SidecarSessionContext,
  type SidecarSessionContextValue,
  type SidecarSessionState,
} from './sidecar-session';

type SidecarSessionAction =
  | { type: 'reset' }
  | { type: 'set-query'; payload: string }
  | {
      type: 'submit-query';
      payload: {
        message: string;
        mode: EntryMode;
      };
    };

const INITIAL_SESSION_STATE: SidecarSessionState = {
  mode: 'local',
  status: 'idle',
  messages: [],
  cards: [],
  errorMessage: null,
  query: '',
};

function createSessionMessage(role: SessionMessage['role'], content: string): SessionMessage {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: `${role}-${randomSuffix}`,
    role,
    content,
  };
}

function buildSystemReply(mode: EntryMode): string {
  if (mode === 'local') {
    return '我先记下这个目标。下一步会优先按本地语义入口整理相关页面卡片。';
  }

  return '我先记下这个目标。下一步会结合上下文帮你整理页面、信息或草稿。';
}

function sidecarSessionReducer(
  state: SidecarSessionState,
  action: SidecarSessionAction,
): SidecarSessionState {
  switch (action.type) {
    case 'reset':
      return INITIAL_SESSION_STATE;
    case 'set-query':
      return {
        ...state,
        query: action.payload,
      };
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
        query: '',
        cards: [],
        messages: [
          ...state.messages,
          createSessionMessage('user', trimmedMessage),
          createSessionMessage('system', buildSystemReply(action.payload.mode)),
        ],
      };
    }
    default:
      return state;
  }
}

export function SidecarSessionProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(sidecarSessionReducer, INITIAL_SESSION_STATE);

  const value = useMemo<SidecarSessionContextValue>(
    () => ({
      session,
      resetSession: () => dispatch({ type: 'reset' }),
      setQuery: (value) => dispatch({ type: 'set-query', payload: value }),
      submitQuery: (payload) => dispatch({ type: 'submit-query', payload }),
    }),
    [session],
  );

  return <SidecarSessionContext.Provider value={value}>{children}</SidecarSessionContext.Provider>;
}
