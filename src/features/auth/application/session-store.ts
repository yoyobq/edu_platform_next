// src/features/auth/application/session-store.ts

import { useSyncExternalStore } from 'react';

import type { AuthSessionSnapshot, AuthSessionState } from './types';

const INITIAL_AUTH_SESSION_STATE: AuthSessionState = {
  status: 'restoring',
  snapshot: null,
  lastError: null,
};

let currentAuthSessionState = INITIAL_AUTH_SESSION_STATE;
const authSessionListeners = new Set<() => void>();

function emitAuthSessionChange() {
  for (const listener of authSessionListeners) {
    listener();
  }
}

function setAuthSessionState(nextState: AuthSessionState) {
  currentAuthSessionState = nextState;
  emitAuthSessionChange();
}

export function getAuthSessionState() {
  return currentAuthSessionState;
}

export function getAuthSessionSnapshot() {
  return currentAuthSessionState.snapshot;
}

export function subscribeAuthSession(listener: () => void) {
  authSessionListeners.add(listener);

  return () => {
    authSessionListeners.delete(listener);
  };
}

export function useAuthSessionState() {
  return useSyncExternalStore(subscribeAuthSession, getAuthSessionState, getAuthSessionState);
}

export function setAuthenticatedSession(snapshot: AuthSessionSnapshot) {
  setAuthSessionState({
    status: 'authenticated',
    snapshot,
    lastError: null,
  });
}

export function setUnauthenticatedSession(lastError: string | null = null) {
  setAuthSessionState({
    status: 'unauthenticated',
    snapshot: null,
    lastError,
  });
}

export function setAuthSessionRestoring() {
  setAuthSessionState({
    status: 'restoring',
    snapshot: currentAuthSessionState.snapshot,
    lastError: null,
  });
}
