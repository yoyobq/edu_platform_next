type StoredUpstreamSessionRecord<Version extends 1 | 2> = {
  accountId: number;
  expiresAt: string | null;
  upstreamLoginId: string | null;
  upstreamSessionToken: string;
  version: Version;
};

export type StoredUpstreamSession = StoredUpstreamSessionRecord<2>;

export type RememberedUpstreamLoginCredentials = {
  password: string;
  rememberCredentials: true;
  userId: string;
};

type LegacyStoredUpstreamSession = StoredUpstreamSessionRecord<1>;

type StoredUpstreamLoginCredentials = RememberedUpstreamLoginCredentials & {
  version: 1;
};

const UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.upstream.session.v2';
const LEGACY_UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.labs.upstream-session-demo.v1';
const UPSTREAM_LOGIN_CREDENTIALS_STORAGE_KEY_PREFIX =
  'aigc-friendly-frontend.upstream.login-credentials.v1';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isStoredUpstreamSessionRecord<Version extends 1 | 2>(
  value: unknown,
  version: Version,
): value is StoredUpstreamSessionRecord<Version> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.version === version &&
    typeof candidate.accountId === 'number' &&
    Number.isInteger(candidate.accountId) &&
    candidate.accountId > 0 &&
    typeof candidate.upstreamSessionToken === 'string' &&
    candidate.upstreamSessionToken.trim().length > 0 &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'string') &&
    (candidate.upstreamLoginId === null || typeof candidate.upstreamLoginId === 'string')
  );
}

function isStoredUpstreamLoginCredentials(value: unknown): value is StoredUpstreamLoginCredentials {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.version === 1 &&
    typeof candidate.userId === 'string' &&
    candidate.userId.trim().length > 0 &&
    typeof candidate.password === 'string' &&
    candidate.password.length > 0 &&
    candidate.rememberCredentials === true
  );
}

function getUpstreamLoginCredentialsStorageKey(accountId: number) {
  return `${UPSTREAM_LOGIN_CREDENTIALS_STORAGE_KEY_PREFIX}.${accountId}`;
}

function readStorageRecord<Version extends 1 | 2>(
  storageKey: string,
  version: Version,
): StoredUpstreamSessionRecord<Version> | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isStoredUpstreamSessionRecord(parsed, version)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function toStoredUpstreamSession(session: LegacyStoredUpstreamSession): StoredUpstreamSession {
  return {
    accountId: session.accountId,
    expiresAt: session.expiresAt,
    upstreamLoginId: session.upstreamLoginId,
    upstreamSessionToken: session.upstreamSessionToken,
    version: 2,
  };
}

function readRawStoredUpstreamSession(): StoredUpstreamSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const currentSession = readStorageRecord(UPSTREAM_SESSION_STORAGE_KEY, 2);

  if (currentSession) {
    window.localStorage.removeItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY);
    return currentSession;
  }

  const legacySession = readStorageRecord(LEGACY_UPSTREAM_SESSION_STORAGE_KEY, 1);

  if (!legacySession) {
    return null;
  }

  const migratedSession = toStoredUpstreamSession(legacySession);

  window.localStorage.setItem(UPSTREAM_SESSION_STORAGE_KEY, JSON.stringify(migratedSession));
  window.localStorage.removeItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY);

  return migratedSession;
}

export function clearStoredUpstreamSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(UPSTREAM_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY);
}

export function clearRememberedUpstreamLoginCredentials(accountId: number) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(getUpstreamLoginCredentialsStorageKey(accountId));
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

export function readRememberedUpstreamLoginCredentials(
  accountId: number,
): RememberedUpstreamLoginCredentials | null {
  if (!canUseStorage()) {
    return null;
  }

  const storageKey = getUpstreamLoginCredentialsStorageKey(accountId);
  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isStoredUpstreamLoginCredentials(parsed)) {
      clearRememberedUpstreamLoginCredentials(accountId);
      return null;
    }

    return {
      password: parsed.password,
      rememberCredentials: true,
      userId: parsed.userId,
    };
  } catch {
    clearRememberedUpstreamLoginCredentials(accountId);
    return null;
  }
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
    version: 2,
  };

  window.localStorage.setItem(UPSTREAM_SESSION_STORAGE_KEY, JSON.stringify(nextValue));
  window.localStorage.removeItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY);
}

export function writeRememberedUpstreamLoginCredentials(input: {
  accountId: number;
  password: string;
  userId: string;
}) {
  if (!canUseStorage()) {
    return;
  }

  const nextValue: StoredUpstreamLoginCredentials = {
    password: input.password,
    rememberCredentials: true,
    userId: input.userId.trim(),
    version: 1,
  };

  if (!nextValue.userId || !nextValue.password) {
    clearRememberedUpstreamLoginCredentials(input.accountId);
    return;
  }

  window.localStorage.setItem(
    getUpstreamLoginCredentialsStorageKey(input.accountId),
    JSON.stringify(nextValue),
  );
}
