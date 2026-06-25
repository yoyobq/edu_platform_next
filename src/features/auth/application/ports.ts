// src/features/auth/application/ports.ts

import type {
  AuthLoginInput,
  AuthPendingSession,
  AuthSessionSnapshot,
  AuthStoredSession,
} from './types';

export type AuthApiPort = {
  login: (input: AuthLoginInput) => Promise<AuthPendingSession>;
  logout: (input: { accessToken: string }) => Promise<void>;
  refresh: (input: { refreshToken: string }) => Promise<AuthPendingSession>;
  restore: (
    session: Pick<AuthStoredSession, 'accessToken' | 'refreshToken'>,
  ) => Promise<AuthSessionSnapshot>;
};

export type AuthStoragePort = {
  clearSession: () => void;
  readSession: () => AuthStoredSession | null;
  writeSession: (session: AuthStoredSession) => void;
};

export type AuthFeedbackPort = {
  queueRefreshFailureMessage: (content?: string) => void;
};

export type AuthPorts = {
  api: AuthApiPort;
  feedback?: AuthFeedbackPort;
  storage: AuthStoragePort;
};
