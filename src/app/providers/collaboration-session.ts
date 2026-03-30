// src/app/providers/collaboration-session.ts

import { createContext, useContext } from 'react';

import type { EntryCard } from '@/app/lib';

export type AppEnv = 'dev' | 'test' | 'prod';
export type EntryMode = 'ai' | 'local';
export type CollaborationAvailability = 'available' | 'degraded' | 'readonly' | 'unavailable';
export type SessionStatus = 'idle' | 'ready' | 'loading' | 'error';
export type SessionMessageRole = 'system' | 'user';

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  content: string;
  cards?: EntryCard[];
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
  submitQuery: (message: string) => void;
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
