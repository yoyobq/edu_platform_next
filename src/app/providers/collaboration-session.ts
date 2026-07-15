// src/app/providers/collaboration-session.ts

import { createContext, useContext } from 'react';

import type { CollaborationAvailability, EntryCard } from '@/app/lib';

import type { AiChatTurnStatus } from '@/features/ai-chat';

export type AppEnv = 'dev' | 'test' | 'prod';
export type EntryMode = 'ai' | 'local';
export type { CollaborationAvailability } from '@/app/lib';
export type SessionStatus = 'idle' | 'ready' | 'loading' | 'error';
export type SessionMessageRole = 'system' | 'user';

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  content: string;
  cards?: EntryCard[];
  status?: AiChatTurnStatus;
};

export type CollaborationSessionState = {
  availability: CollaborationAvailability;
  mode: EntryMode;
  status: SessionStatus;
  messages: SessionMessage[];
  errorMessage: string | null;
};

export type CollaborationSessionContextValue = {
  session: CollaborationSessionState;
  resetSession: () => void;
  submitQuery: (message: string) => boolean;
};

export const CollaborationSessionContext = createContext<CollaborationSessionContextValue | null>(
  null,
);

export function useCollaborationSession() {
  const contextValue = useContext(CollaborationSessionContext);

  if (!contextValue) {
    throw new Error('useCollaborationSession must be used within CollaborationSessionProvider.');
  }

  return contextValue;
}
