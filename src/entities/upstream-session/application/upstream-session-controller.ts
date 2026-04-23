import { useCallback, useState } from 'react';

import { requestUpstreamLoginSession } from '../infrastructure/upstream-session-api';
import {
  clearStoredUpstreamSession,
  readStoredUpstreamSession,
  type StoredUpstreamSession,
  writeStoredUpstreamSession,
} from '../infrastructure/upstream-session-storage';

export type UpstreamAccountIdentity = {
  accountId: number;
  displayName: string;
};

type RollingUpstreamSessionInput = {
  expiresAt?: string | null;
  upstreamLoginId?: string | null;
  upstreamSessionToken: string;
};

type UseUpstreamSessionOptions = {
  account: UpstreamAccountIdentity | null;
};

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

  const clear = useCallback(() => {
    clearUpstreamSessionState();
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
      return nextSession;
    },
    [accountId, commitSession],
  );

  return {
    clear,
    login,
    persistRollingSession,
    session,
  };
}
