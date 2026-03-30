// src/features/auth/infrastructure/auth-storage.ts

import type { AuthStoragePort } from '../application/ports';

import { deserializeSessionSnapshot, serializeSessionSnapshot } from './mapper';

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v1';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const authStorage: AuthStoragePort = {
  clearSession() {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  },
  readSession() {
    if (!canUseStorage()) {
      return null;
    }

    const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const snapshot = deserializeSessionSnapshot(rawValue);

    if (!snapshot) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    return snapshot;
  },
  writeSession(session) {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(AUTH_STORAGE_KEY, serializeSessionSnapshot(session));
  },
};
