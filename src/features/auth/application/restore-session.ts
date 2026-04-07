// src/features/auth/application/restore-session.ts
/* eslint-disable simple-import-sort/imports */

import {
  getAuthSessionState,
  setAuthenticatedSession,
  setAuthSessionRestoring,
  setHydratingSession,
  setUnauthenticatedSession,
} from './session-store';
import { isAuthPendingSession, type AuthSessionSnapshot } from './types';
import type { AuthPorts } from './ports';

const AUTH_REFRESH_FEEDBACK_FLASH_KEY = 'platform_next.auth_refresh_feedback_flash';

function queueAuthFailureFlash(content: string) {
  window.sessionStorage.setItem(
    AUTH_REFRESH_FEEDBACK_FLASH_KEY,
    JSON.stringify({
      content,
      type: 'error',
    } satisfies {
      content: string;
      type: 'error';
    }),
  );
}

let restorePromise: Promise<AuthSessionSnapshot | null> | null = null;

export async function restoreSession(
  ports: AuthPorts,
  options?: { background?: boolean },
): Promise<AuthSessionSnapshot | null> {
  if (getAuthSessionState().status === 'authenticated') {
    return getAuthSessionState().snapshot;
  }

  if (restorePromise) {
    return options?.background ? null : restorePromise;
  }

  const snapshot = ports.storage.readSession();

  if (!snapshot) {
    ports.storage.clearSession();
    setUnauthenticatedSession();
    return null;
  }

  if (isAuthPendingSession(snapshot)) {
    setHydratingSession(snapshot);
  } else {
    setAuthSessionRestoring();
  }

  restorePromise = (async () => {
    try {
      const restoredSnapshot = await ports.api.restore(snapshot);

      ports.storage.writeSession(restoredSnapshot);
      setAuthenticatedSession(restoredSnapshot);

      return restoredSnapshot;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '当前会话已失效，请重新登录。';

      if (options?.background || isAuthPendingSession(snapshot)) {
        queueAuthFailureFlash(errorMessage);
      }

      ports.storage.clearSession();
      setUnauthenticatedSession(errorMessage);
      return null;
    }
  })().finally(() => {
    restorePromise = null;
  });

  return options?.background || isAuthPendingSession(snapshot) ? null : restorePromise;
}
