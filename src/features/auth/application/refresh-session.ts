import { isGraphQLIngressError } from '@/shared/graphql';

import type { AuthPorts } from './ports';
import {
  getCurrentAuthSession,
  setAuthenticatedSession,
  setHydratingSession,
  setUnauthenticatedSession,
} from './session-store';
import { type AuthPendingSession, type AuthSessionSnapshot, isAuthPendingSession } from './types';

const refreshPromises = new Map<string, Promise<AuthSessionSnapshot>>();

function isRefreshTokenStillCurrent(ports: AuthPorts, refreshToken: string) {
  const currentSession = getCurrentAuthSession() ?? ports.storage.readSession();

  return currentSession?.refreshToken === refreshToken;
}

function isPendingSessionStillCurrent(ports: AuthPorts, session: AuthPendingSession) {
  const currentSession = getCurrentAuthSession() ?? ports.storage.readSession();

  return (
    currentSession?.accessToken === session.accessToken &&
    currentSession.refreshToken === session.refreshToken
  );
}

function getCurrentRefreshSnapshot(ports: AuthPorts, refreshToken: string) {
  const currentSession = getCurrentAuthSession();

  if (
    currentSession &&
    !isAuthPendingSession(currentSession) &&
    currentSession.refreshToken === refreshToken
  ) {
    return currentSession;
  }

  const storedSession = ports.storage.readSession();

  if (
    storedSession &&
    !isAuthPendingSession(storedSession) &&
    storedSession.refreshToken === refreshToken
  ) {
    return storedSession;
  }

  return null;
}

function getSessionErrorMessage(error: unknown) {
  if (isGraphQLIngressError(error)) {
    return error.userMessage;
  }

  return error instanceof Error ? error.message : '当前会话暂时无法恢复，请稍后重试。';
}

function isAuthSessionFailure(error: unknown) {
  return isGraphQLIngressError(error) && error.type === 'auth';
}

function buildRetainedSnapshot(
  snapshot: AuthSessionSnapshot,
  pendingSession: AuthPendingSession,
): AuthSessionSnapshot {
  return {
    ...snapshot,
    accessToken: pendingSession.accessToken,
    refreshToken: pendingSession.refreshToken,
  };
}

export function refreshSessionWithLock(
  ports: AuthPorts,
  refreshToken: string,
): Promise<AuthSessionSnapshot> {
  const existingPromise = refreshPromises.get(refreshToken);

  if (existingPromise) {
    return existingPromise;
  }

  const fallbackSnapshot = getCurrentRefreshSnapshot(ports, refreshToken);

  const refreshPromise = (async () => {
    const pendingSession = await ports.api.refresh({
      refreshToken,
    });

    if (isRefreshTokenStillCurrent(ports, refreshToken)) {
      ports.storage.writeSession(pendingSession);
      setHydratingSession(pendingSession);
    }

    let refreshedSnapshot: AuthSessionSnapshot;

    try {
      refreshedSnapshot = await ports.api.restore(pendingSession);
    } catch (error) {
      if (!isPendingSessionStillCurrent(ports, pendingSession)) {
        throw error;
      }

      if (isAuthSessionFailure(error)) {
        ports.storage.clearSession();
        setUnauthenticatedSession(getSessionErrorMessage(error));
        throw error;
      }

      if (fallbackSnapshot) {
        const retainedSnapshot = buildRetainedSnapshot(fallbackSnapshot, pendingSession);

        ports.storage.writeSession(retainedSnapshot);
        setAuthenticatedSession(retainedSnapshot);

        return retainedSnapshot;
      }

      setUnauthenticatedSession(getSessionErrorMessage(error));
      throw error;
    }

    if (isPendingSessionStillCurrent(ports, pendingSession)) {
      ports.storage.writeSession(refreshedSnapshot);
      setAuthenticatedSession(refreshedSnapshot);
    }

    return refreshedSnapshot;
  })().finally(() => {
    refreshPromises.delete(refreshToken);
  });

  refreshPromises.set(refreshToken, refreshPromise);

  return refreshPromise;
}

export async function refreshSession(ports: AuthPorts): Promise<AuthSessionSnapshot> {
  const currentSession = getCurrentAuthSession() ?? ports.storage.readSession();

  if (!currentSession) {
    throw new Error('当前没有可刷新的登录会话。');
  }

  return refreshSessionWithLock(ports, currentSession.refreshToken);
}
