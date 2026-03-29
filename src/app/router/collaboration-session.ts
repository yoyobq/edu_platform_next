import { createContext, useContext } from 'react';

export type EntryMode = 'ai' | 'local';
export type CollaborationAvailability = 'available' | 'degraded' | 'readonly' | 'unavailable';
export type SessionStatus = 'idle' | 'ready' | 'loading' | 'error';
export type SessionMessageRole = 'system' | 'user';

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  content: string;
};

export type EntryCard = {
  id: string;
  title: string;
  description?: string;
  to: string;
  kind: 'route';
};

export type CollaborationSessionState = {
  availability: CollaborationAvailability;
  mode: EntryMode;
  status: SessionStatus;
  messages: SessionMessage[];
  cards: EntryCard[];
  errorMessage: string | null;
  query: string;
};

export type CollaborationSessionContextValue = {
  session: CollaborationSessionState;
  resetSession: () => void;
  setQuery: (value: string) => void;
  submitQuery: (payload: { message: string; mode: EntryMode }) => void;
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
