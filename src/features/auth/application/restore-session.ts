// src/features/auth/application/restore-session.ts

import { isGraphQLIngressError } from '@/shared/graphql';

import type { AuthPorts } from './ports';
import { refreshSessionWithLock } from './refresh-session';
import {
  getAuthSessionState,
  getCurrentAuthSession,
  setAuthenticatedSession,
  setAuthSessionRestoring,
  setHydratingSession,
  setUnauthenticatedSession,
} from './session-store';
import { type AuthSessionSnapshot, type AuthStoredSession, isAuthPendingSession } from './types';

const restorePromises = new Map<string, Promise<AuthSessionSnapshot | null>>();

type RestoreSessionOptions = {
  background?: boolean;
  waitForPending?: boolean;
};

function isSameSessionTokenPair(
  left: Pick<AuthStoredSession, 'accessToken' | 'refreshToken'> | null | undefined,
  right: Pick<AuthStoredSession, 'accessToken' | 'refreshToken'>,
) {
  return left?.accessToken === right.accessToken && left.refreshToken === right.refreshToken;
}

function getSessionTokenKey(session: Pick<AuthStoredSession, 'accessToken' | 'refreshToken'>) {
  return JSON.stringify([session.accessToken, session.refreshToken]);
}

function isRestoreSessionStillCurrent(
  ports: AuthPorts,
  session: Pick<AuthStoredSession, 'accessToken' | 'refreshToken'>,
) {
  return isSameSessionTokenPair(getCurrentAuthSession() ?? ports.storage.readSession(), session);
}

function getSessionErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

function isAuthSessionFailure(error: unknown) {
  return isGraphQLIngressError(error) && error.type === 'auth';
}

function failRestoreSession(input: {
  error: unknown;
  isBackground: boolean;
  ports: AuthPorts;
  snapshot: AuthStoredSession;
}) {
  const errorMessage = getSessionErrorMessage(input.error, '当前会话已失效，请重新登录。');

  if (input.isBackground || isAuthPendingSession(input.snapshot)) {
    input.ports.feedback?.queueRefreshFailureMessage(errorMessage);
  }

  input.ports.storage.clearSession();
  setUnauthenticatedSession(errorMessage);
  return null;
}

function retainRestoreSession(input: {
  error: unknown;
  isBackground: boolean;
  snapshot: AuthStoredSession;
}) {
  const errorMessage = getSessionErrorMessage(input.error, '当前会话暂时无法恢复，请稍后重试。');

  if (input.isBackground || isAuthPendingSession(input.snapshot)) {
    input.ports.feedback?.queueRefreshFailureMessage(errorMessage);
  }

  if (isAuthPendingSession(input.snapshot)) {
    setUnauthenticatedSession(errorMessage);
    return null;
  }

  setAuthenticatedSession(input.snapshot);
  return input.snapshot;
}

export async function restoreSession(
  ports: AuthPorts,
  options?: RestoreSessionOptions,
): Promise<AuthSessionSnapshot | null> {
  if (getAuthSessionState().status === 'authenticated') {
    return getAuthSessionState().snapshot;
  }

  const snapshot = ports.storage.readSession();

  if (!snapshot) {
    ports.storage.clearSession();
    setUnauthenticatedSession();
    return null;
  }

  const restoreKey = getSessionTokenKey(snapshot);
  const runningRestorePromise = restorePromises.get(restoreKey);

  if (runningRestorePromise) {
    return options?.background ? null : runningRestorePromise;
  }

  if (isAuthPendingSession(snapshot)) {
    setHydratingSession(snapshot);
  } else {
    setAuthSessionRestoring();
  }

  const nextRestorePromise = (async () => {
    try {
      const restoredSnapshot = await ports.api.restore(snapshot);

      if (!isRestoreSessionStillCurrent(ports, snapshot)) {
        return null;
      }

      ports.storage.writeSession(restoredSnapshot);
      setAuthenticatedSession(restoredSnapshot);

      return restoredSnapshot;
    } catch (error) {
      if (!isRestoreSessionStillCurrent(ports, snapshot)) {
        return null;
      }

      if (isAuthSessionFailure(error)) {
        try {
          return await refreshSessionWithLock(ports, snapshot.refreshToken);
        } catch (refreshError) {
          if (!isRestoreSessionStillCurrent(ports, snapshot)) {
            return null;
          }

          if (isAuthSessionFailure(refreshError)) {
            return failRestoreSession({
              error: refreshError,
              isBackground: options?.background === true,
              ports,
              snapshot,
            });
          }

          return retainRestoreSession({
            error: refreshError,
            isBackground: options?.background === true,
            snapshot,
          });
        }
      }

      return retainRestoreSession({
        error,
        isBackground: options?.background === true,
        snapshot,
      });
    }
  })().finally(() => {
    if (restorePromises.get(restoreKey) === nextRestorePromise) {
      restorePromises.delete(restoreKey);
    }
  });

  restorePromises.set(restoreKey, nextRestorePromise);

  return options?.background || (isAuthPendingSession(snapshot) && !options?.waitForPending)
    ? null
    : nextRestorePromise;
}
