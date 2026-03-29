import { createContext, useContext } from 'react';

export type EntryMode = 'ai' | 'local';
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

export type SidecarSessionState = {
  mode: EntryMode;
  status: SessionStatus;
  messages: SessionMessage[];
  cards: EntryCard[];
  errorMessage: string | null;
  query: string;
};

export type SidecarSessionContextValue = {
  session: SidecarSessionState;
  resetSession: () => void;
  setQuery: (value: string) => void;
  submitQuery: (payload: { message: string; mode: EntryMode }) => void;
};

export const SidecarSessionContext = createContext<SidecarSessionContextValue | null>(null);

export function useSidecarSession() {
  const contextValue = useContext(SidecarSessionContext);

  if (!contextValue) {
    throw new Error('useSidecarSession must be used within SidecarSessionProvider.');
  }

  return contextValue;
}
