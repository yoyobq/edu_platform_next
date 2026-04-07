// src/features/auth/application/ports.ts

import type {
  AuthLoginInput,
  AuthPendingSession,
  AuthSessionSnapshot,
  AuthStoredSession,
} from './types';

export type AuthApiPort = {
  login: (input: AuthLoginInput) => Promise<AuthPendingSession>;
  refresh: (input: { refreshToken: string }) => Promise<AuthSessionSnapshot>;
  restore: (
    session: Pick<AuthStoredSession, 'accessToken' | 'refreshToken'>,
  ) => Promise<AuthSessionSnapshot>;
};

export type AuthStoragePort = {
  clearSession: () => void;
  readSession: () => AuthStoredSession | null;
  writeSession: (session: AuthStoredSession) => void;
};

export type AuthPorts = {
  api: AuthApiPort;
  storage: AuthStoragePort;
};
