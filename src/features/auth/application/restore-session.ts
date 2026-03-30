// src/features/auth/application/restore-session.ts

import type { AuthPorts } from './ports';
import {
  getAuthSessionState,
  setAuthenticatedSession,
  setAuthSessionRestoring,
  setUnauthenticatedSession,
} from './session-store';
import type { AuthSessionSnapshot } from './types';

let restorePromise: Promise<AuthSessionSnapshot | null> | null = null;

export async function restoreSession(ports: AuthPorts): Promise<AuthSessionSnapshot | null> {
  if (getAuthSessionState().status === 'authenticated') {
    return getAuthSessionState().snapshot;
  }

  if (restorePromise) {
    return restorePromise;
  }

  setAuthSessionRestoring();

  restorePromise = (async () => {
    const snapshot = ports.storage.readSession();

    if (!snapshot) {
      ports.storage.clearSession();
      setUnauthenticatedSession();
      return null;
    }

    setAuthenticatedSession(snapshot);
    return snapshot;
  })().finally(() => {
    restorePromise = null;
  });

  return restorePromise;
}
