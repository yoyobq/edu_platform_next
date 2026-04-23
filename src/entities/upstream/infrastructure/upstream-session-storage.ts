export type StoredUpstreamSession = {
  accountId: number;
  expiresAt: string | null;
  upstreamLoginId: string | null;
  upstreamSessionToken: string;
  version: 1;
};

const UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.labs.upstream-session-demo.v1';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isStoredUpstreamSession(value: unknown): value is StoredUpstreamSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.version === 1 &&
    typeof candidate.accountId === 'number' &&
    Number.isInteger(candidate.accountId) &&
    candidate.accountId > 0 &&
    typeof candidate.upstreamSessionToken === 'string' &&
    candidate.upstreamSessionToken.trim().length > 0 &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'string') &&
    (candidate.upstreamLoginId === null || typeof candidate.upstreamLoginId === 'string')
  );
}

function readRawStoredUpstreamSession(): StoredUpstreamSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(UPSTREAM_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isStoredUpstreamSession(parsed)) {
      window.localStorage.removeItem(UPSTREAM_SESSION_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(UPSTREAM_SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearStoredUpstreamSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(UPSTREAM_SESSION_STORAGE_KEY);
}

export function readStoredUpstreamSession(accountId: number): StoredUpstreamSession | null {
  const session = readRawStoredUpstreamSession();

  if (!session) {
    return null;
  }

  if (session.accountId !== accountId) {
    clearStoredUpstreamSession();
    return null;
  }

  return session;
}

export function writeStoredUpstreamSession(input: {
  accountId: number;
  expiresAt?: string | null;
  upstreamLoginId?: string | null;
  upstreamSessionToken: string;
}) {
  if (!canUseStorage()) {
    return;
  }

  const nextValue: StoredUpstreamSession = {
    accountId: input.accountId,
    expiresAt: input.expiresAt ?? null,
    upstreamLoginId: input.upstreamLoginId?.trim() || null,
    upstreamSessionToken: input.upstreamSessionToken.trim(),
    version: 1,
  };

  window.localStorage.setItem(UPSTREAM_SESSION_STORAGE_KEY, JSON.stringify(nextValue));
}
