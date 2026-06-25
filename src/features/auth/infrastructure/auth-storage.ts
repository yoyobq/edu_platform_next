// src/features/auth/infrastructure/auth-storage.ts

import type { AuthStoragePort } from '../application/ports';

import { AUTH_SESSION_STORAGE_KEY } from './auth-storage-key';
import { deserializeStoredSession, serializeStoredSession } from './mapper';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const authStorage: AuthStoragePort = {
  clearSession() {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  },
  readSession() {
    if (!canUseStorage()) {
      return null;
    }

    const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const snapshot = deserializeStoredSession(rawValue);

    if (!snapshot) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }

    return snapshot;
  },
  writeSession(session) {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, serializeStoredSession(session));
  },
};
