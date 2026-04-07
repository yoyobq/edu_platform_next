// src/features/auth/application/session-store.ts

import { useSyncExternalStore } from 'react';

import type { AuthPendingSession, AuthSessionSnapshot, AuthSessionState } from './types';

const INITIAL_AUTH_SESSION_STATE: AuthSessionState = {
  status: 'restoring',
  pendingSession: null,
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

export function getAuthPendingSession() {
  return currentAuthSessionState.pendingSession;
}

export function getCurrentAuthSession() {
  return currentAuthSessionState.snapshot ?? currentAuthSessionState.pendingSession;
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
    pendingSession: null,
    snapshot,
    lastError: null,
  });
}

export function setHydratingSession(session: AuthPendingSession) {
  setAuthSessionState({
    status: 'hydrating',
    pendingSession: session,
    snapshot: currentAuthSessionState.snapshot,
    lastError: null,
  });
}

export function setUnauthenticatedSession(lastError: string | null = null) {
  setAuthSessionState({
    status: 'unauthenticated',
    pendingSession: null,
    snapshot: null,
    lastError,
  });
}

export function setAuthSessionRestoring() {
  setAuthSessionState({
    status: 'restoring',
    pendingSession: null,
    snapshot: currentAuthSessionState.snapshot,
    lastError: null,
  });
}
