import type { StoredUpstreamSession } from '../infrastructure/upstream-session-storage';

export type RollingUpstreamSessionResult = {
  expiresAt?: string | null;
  upstreamLoginId?: string | null;
  upstreamSessionToken?: string | null;
};

export type PersistUpstreamSessionFromResult = (
  currentSession: StoredUpstreamSession,
  result: RollingUpstreamSessionResult,
) => StoredUpstreamSession;

export function hasRollingUpstreamSessionResult(
  value: RollingUpstreamSessionResult | null | undefined,
): value is RollingUpstreamSessionResult & {
  expiresAt: string;
  upstreamSessionToken: string;
} {
  return Boolean(
    typeof value?.upstreamSessionToken === 'string' &&
    value.upstreamSessionToken.trim() &&
    typeof value.expiresAt === 'string' &&
    value.expiresAt.trim(),
  );
}
