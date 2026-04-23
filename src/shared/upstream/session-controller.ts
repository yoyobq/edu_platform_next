import { useCallback, useState } from 'react';

import {
  clearStoredUpstreamSession,
  readStoredUpstreamSession,
  type StoredUpstreamSession,
  writeStoredUpstreamSession,
} from './session-storage';

export type UpstreamAccountIdentity = {
  accountId: number;
  displayName: string;
};

type PersistedUpstreamSessionInput = {
  expiresAt?: string | null;
  upstreamLoginId?: string | null;
  upstreamSessionToken: string;
};

type UpstreamLoginSessionRequest = (input: { password: string; userId: string }) => Promise<{
  expiresAt: string | null;
  upstreamSessionToken: string;
}>;

type UseStoredUpstreamSessionOptions = {
  account: UpstreamAccountIdentity | null;
};

export function persistUpstreamSession(
  session: StoredUpstreamSession,
  input: PersistedUpstreamSessionInput,
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

export function createUpstreamSession(input: {
  accountId: number;
  expiresAt: string | null;
  upstreamLoginId?: string | null;
  upstreamSessionToken: string;
}) {
  const nextSession: StoredUpstreamSession = {
    accountId: input.accountId,
    expiresAt: input.expiresAt,
    upstreamLoginId: input.upstreamLoginId?.trim() || null,
    upstreamSessionToken: input.upstreamSessionToken,
    version: 1,
  };

  writeStoredUpstreamSession(nextSession);

  return nextSession;
}

export function clearUpstreamSessionState() {
  clearStoredUpstreamSession();
}

export function useStoredUpstreamSession(options: UseStoredUpstreamSessionOptions) {
  const [, setStorageRevision] = useState(0);
  const accountId = options.account?.accountId ?? null;
  const storedSession = accountId ? readStoredUpstreamSession(accountId) : null;
  const refreshStoredSession = useCallback(() => {
    setStorageRevision((revision) => revision + 1);
  }, []);

  const persistSession = useCallback(
    (session: StoredUpstreamSession, input: PersistedUpstreamSessionInput) => {
      const nextSession = persistUpstreamSession(session, input);

      refreshStoredSession();
      return nextSession;
    },
    [refreshStoredSession],
  );

  const clearSession = useCallback(() => {
    clearUpstreamSessionState();
    refreshStoredSession();
  }, [refreshStoredSession]);

  const commitSession = useCallback(
    (session: StoredUpstreamSession) => {
      writeStoredUpstreamSession(session);
      refreshStoredSession();
    },
    [refreshStoredSession],
  );

  const loginAndStoreSession = useCallback(
    async (input: { login: UpstreamLoginSessionRequest; password: string; userId: string }) => {
      if (!accountId) {
        throw new Error('当前登录账号尚未就绪，请稍后再试。');
      }

      const normalizedUserId = input.userId.trim();
      const upstreamSession = await input.login({
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
    clearSession,
    commitSession,
    loginAndStoreSession,
    persistSession,
    storedSession,
  };
}
