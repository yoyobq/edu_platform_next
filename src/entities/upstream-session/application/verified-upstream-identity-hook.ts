// src/entities/upstream-session/application/verified-upstream-identity-hook.ts

import { useEffect, useRef, useState } from 'react';

import {
  readVerifiedStaffIdentity,
  type VerifiedStaffIdentityResult,
} from '../infrastructure/staff-directory';
import type { StoredUpstreamSession } from '../infrastructure/upstream-session-storage';

import { isExpiredUpstreamSessionError } from './upstream-error-feedback';
import type { PersistUpstreamSessionFromResult } from './upstream-session-rolling';

export type VerifiedUpstreamIdentityState = {
  error: string | null;
  identity: VerifiedStaffIdentityResult | null;
  loading: boolean;
};

export function useVerifiedUpstreamIdentity(input: {
  onExpiredSession: (session: StoredUpstreamSession) => void;
  persistSessionFromResult: PersistUpstreamSessionFromResult;
  session: StoredUpstreamSession | null;
}): VerifiedUpstreamIdentityState {
  const { onExpiredSession, persistSessionFromResult, session } = input;
  const sessionRef = useRef(session);
  const [state, setState] = useState<VerifiedUpstreamIdentityState>({
    error: null,
    identity: null,
    loading: false,
  });
  const sessionKey = session
    ? `${session.accountId}:${session.upstreamLoginId ?? ''}:${session.upstreamSessionToken}`
    : 'none';

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      setState({ error: null, identity: null, loading: false });
      return undefined;
    }

    let cancelled = false;
    setState({ error: null, identity: null, loading: true });

    void readVerifiedStaffIdentity({
      upstreamSessionToken: activeSession.upstreamSessionToken,
    })
      .then((identity) => {
        if (cancelled) {
          return;
        }
        persistSessionFromResult(activeSession, identity);
        setState({ error: null, identity, loading: false });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isExpiredUpstreamSessionError(error)) {
          onExpiredSession(activeSession);
          return;
        }
        setState({
          error: error instanceof Error ? error.message : '暂时无法确认校园网身份。',
          identity: null,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [onExpiredSession, persistSessionFromResult, sessionKey]);

  return state;
}
