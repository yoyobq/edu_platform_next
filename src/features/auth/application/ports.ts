// src/features/auth/application/ports.ts

import type { AuthLoginInput, AuthSessionSnapshot } from './types';

export type AuthApiPort = {
  login: (input: AuthLoginInput) => Promise<AuthSessionSnapshot>;
  restore: (
    session: Pick<AuthSessionSnapshot, 'accessToken' | 'refreshToken'>,
  ) => Promise<AuthSessionSnapshot>;
};

export type AuthStoragePort = {
  clearSession: () => void;
  readSession: () => AuthSessionSnapshot | null;
  writeSession: (session: AuthSessionSnapshot) => void;
};

export type AuthPorts = {
  api: AuthApiPort;
  storage: AuthStoragePort;
};
