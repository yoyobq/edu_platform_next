import { useCallback, useEffect, useRef, useState } from 'react';

import {
  requestUpstreamLoginSession,
  requestUpstreamSessionRefresh,
} from '../infrastructure/upstream-session-api';
import {
  clearStoredUpstreamSession,
  readStoredUpstreamSession,
  type StoredUpstreamSession,
  writeStoredUpstreamSession,
} from '../infrastructure/upstream-session-storage';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from './upstream-error-feedback';
import {
  hasRollingUpstreamSessionResult,
  type RollingUpstreamSessionResult,
} from './upstream-session-rolling';

export type UpstreamAccountIdentity = {
  accountId: number;
  displayName: string;
};

type RollingUpstreamSessionInput = {
  expiresAt?: string | null;
  upstreamLoginId?: string | null;
  upstreamSessionToken: string;
};

export type UpstreamSessionKeepAliveFailure = {
  message: string;
  upstreamLoginId: string | null;
};

type UseUpstreamSessionOptions = {
  account: UpstreamAccountIdentity | null;
  keepAlive?: boolean;
  refreshLeadTimeMs?: number;
};

const DEFAULT_REFRESH_LEAD_TIME_MS = 2 * 60 * 1000;
const MIN_REFRESH_DELAY_MS = 1000;

function persistUpstreamSession(
  session: StoredUpstreamSession,
  input: RollingUpstreamSessionInput,
) {
  writeStoredUpstreamSession({
    accountId: session.accountId,
    expiresAt: input.expiresAt ?? session.expiresAt,
    upstreamLoginId: input.upstreamLoginId ?? session.upstreamLoginId,
    upstreamSessionToken: input.upstreamSessionToken,
  });

  return (
    readStoredUpstreamSession(session.accountId) ?? {
      ...session,
      expiresAt: input.expiresAt ?? session.expiresAt,
      upstreamLoginId: input.upstreamLoginId ?? session.upstreamLoginId,
      upstreamSessionToken: input.upstreamSessionToken,
    }
  );
}

function createUpstreamSession(input: {
  accountId: number;
  expiresAt: string | null;
  upstreamLoginId?: string | null;
  upstreamSessionToken: string;
}): StoredUpstreamSession {
  return {
    accountId: input.accountId,
    expiresAt: input.expiresAt,
    upstreamLoginId: input.upstreamLoginId?.trim() || null,
    upstreamSessionToken: input.upstreamSessionToken,
    version: 2,
  };
}

function clearUpstreamSessionState() {
  clearStoredUpstreamSession();
}

export function useUpstreamSession(options: UseUpstreamSessionOptions) {
  const [, setStorageRevision] = useState(0);
  const [keepAliveFailure, setKeepAliveFailure] = useState<UpstreamSessionKeepAliveFailure | null>(
    null,
  );
  const refreshPromiseRef = useRef<Promise<StoredUpstreamSession> | null>(null);
  const accountId = options.account?.accountId ?? null;
  const session = accountId ? readStoredUpstreamSession(accountId) : null;
  const refreshStoredSession = useCallback(() => {
    setStorageRevision((revision) => revision + 1);
  }, []);

  const persistRollingSession = useCallback(
    (currentSession: StoredUpstreamSession, input: RollingUpstreamSessionInput) => {
      const nextSession = persistUpstreamSession(currentSession, input);

      refreshStoredSession();
      return nextSession;
    },
    [refreshStoredSession],
  );

  const persistSessionFromResult = useCallback(
    (currentSession: StoredUpstreamSession, result: RollingUpstreamSessionResult) => {
      if (!hasRollingUpstreamSessionResult(result)) {
        return currentSession;
      }

      return persistRollingSession(currentSession, {
        expiresAt: result.expiresAt,
        upstreamLoginId: result.upstreamLoginId,
        upstreamSessionToken: result.upstreamSessionToken,
      });
    },
    [persistRollingSession],
  );

  const clear = useCallback(() => {
    clearUpstreamSessionState();
    setKeepAliveFailure(null);
    refreshStoredSession();
  }, [refreshStoredSession]);

  const commitSession = useCallback(
    (nextSession: StoredUpstreamSession) => {
      writeStoredUpstreamSession(nextSession);
      refreshStoredSession();
    },
    [refreshStoredSession],
  );

  const login = useCallback(
    async (input: { password: string; userId: string }) => {
      if (!accountId) {
        throw new Error('当前登录账号尚未就绪，请稍后再试。');
      }

      const normalizedUserId = input.userId.trim();
      const upstreamSession = await requestUpstreamLoginSession({
        password: input.password,
        userId: normalizedUserId,
      });
      const nextSession = createUpstreamSession({
        accountId,
        expiresAt: upstreamSession.expiresAt,
        upstreamLoginId: normalizedUserId || null,
        upstreamSessionToken: upstreamSession.upstreamSessionToken,
      });

      commitSession(nextSession);
      setKeepAliveFailure(null);
      return nextSession;
    },
    [accountId, commitSession],
  );

  const refreshSession = useCallback(
    async (currentSession: StoredUpstreamSession = session as StoredUpstreamSession) => {
      if (!currentSession) {
        throw new Error('尚未建立 upstream 会话。');
      }

      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      refreshPromiseRef.current = (async () => {
        try {
          const result = await requestUpstreamSessionRefresh({
            sessionToken: currentSession.upstreamSessionToken,
          });
          const nextSession = persistSessionFromResult(currentSession, result);

          setKeepAliveFailure(null);
          return nextSession;
        } catch (error) {
          clearUpstreamSessionState();
          setKeepAliveFailure({
            message: isExpiredUpstreamSessionError(error)
              ? 'upstream 会话已失效，请重新登录后继续。'
              : resolveUpstreamErrorMessage(error, 'upstream 会话刷新失败，请重新登录后继续。'),
            upstreamLoginId: currentSession.upstreamLoginId,
          });
          refreshStoredSession();
          throw error;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();

      return refreshPromiseRef.current;
    },
    [persistSessionFromResult, refreshStoredSession, session],
  );

  useEffect(() => {
    if (!options.keepAlive || !session?.expiresAt) {
      return undefined;
    }

    const expiresAtTimestamp = new Date(session.expiresAt).getTime();

    if (Number.isNaN(expiresAtTimestamp)) {
      return undefined;
    }

    const leadTime = options.refreshLeadTimeMs ?? DEFAULT_REFRESH_LEAD_TIME_MS;
    const delay = Math.max(expiresAtTimestamp - Date.now() - leadTime, MIN_REFRESH_DELAY_MS);
    const timeoutId = window.setTimeout(() => {
      refreshSession(session).catch(() => undefined);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [options.keepAlive, options.refreshLeadTimeMs, refreshSession, session]);

  return {
    clear,
    keepAliveFailure,
    login,
    persistSessionFromResult,
    persistRollingSession,
    refreshSession,
    session,
  };
}
