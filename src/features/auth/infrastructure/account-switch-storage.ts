// src/features/auth/infrastructure/account-switch-storage.ts

import { AUTH_SESSION_STORAGE_KEY } from '@/shared/auth-session';

import { type AccountSwitchLabSession, canUseAccountSwitchLabSession } from './account-switch-api';

export type AccountSwitchLabRecord = {
  addedAt: string;
  session: AccountSwitchLabSession;
};

const ACCOUNT_SWITCH_LAB_STORAGE_KEY = 'aigc-friendly-frontend.labs.account-switch.v1';
const ACCOUNT_SWITCH_LAB_LIMIT = 2;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isSessionSnapshot(value: unknown): value is AccountSwitchLabSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AccountSwitchLabSession>;

  return (
    candidate.isAuthenticated === true &&
    typeof candidate.accountId === 'number' &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    Boolean(candidate.account) &&
    Boolean(candidate.userInfo)
  );
}

function isPersistedSession(
  value: unknown,
): value is Omit<AccountSwitchLabSession, 'isAuthenticated'> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AccountSwitchLabSession> & { version?: unknown };

  return (
    candidate.version === 2 &&
    typeof candidate.accountId === 'number' &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    Boolean(candidate.account) &&
    Boolean(candidate.userInfo)
  );
}

function isRecord(value: unknown): value is AccountSwitchLabRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AccountSwitchLabRecord>;

  return typeof candidate.addedAt === 'string' && isSessionSnapshot(candidate.session);
}

export function readAccountSwitchLabRecords(): AccountSwitchLabRecord[] {
  if (!canUseStorage()) {
    return [];
  }

  const rawValue = window.localStorage.getItem(ACCOUNT_SWITCH_LAB_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(ACCOUNT_SWITCH_LAB_STORAGE_KEY);
      return [];
    }

    return parsed
      .filter(isRecord)
      .filter((record) => canUseAccountSwitchLabSession(record.session))
      .slice(0, ACCOUNT_SWITCH_LAB_LIMIT);
  } catch {
    window.localStorage.removeItem(ACCOUNT_SWITCH_LAB_STORAGE_KEY);
    return [];
  }
}

export function writeAccountSwitchLabRecords(records: readonly AccountSwitchLabRecord[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    ACCOUNT_SWITCH_LAB_STORAGE_KEY,
    JSON.stringify(records.slice(0, ACCOUNT_SWITCH_LAB_LIMIT)),
  );
}

export function upsertAccountSwitchLabRecord(
  records: readonly AccountSwitchLabRecord[],
  session: AccountSwitchLabSession,
) {
  const nextRecord: AccountSwitchLabRecord = {
    addedAt: new Date().toISOString(),
    session,
  };
  const existingIndex = records.findIndex(
    (record) => record.session.accountId === session.accountId,
  );

  if (existingIndex >= 0) {
    return records.map((record, index) => (index === existingIndex ? nextRecord : record));
  }

  if (records.length >= ACCOUNT_SWITCH_LAB_LIMIT) {
    throw new Error('当前 lab 只保留两个账号，请先移除一个账号后再添加。');
  }

  return [...records, nextRecord];
}

export function readCurrentAuthSession(): AccountSwitchLabSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (isSessionSnapshot(parsed)) {
      return parsed;
    }

    if (isPersistedSession(parsed)) {
      return {
        ...parsed,
        isAuthenticated: true,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function writeCurrentAuthSession(session: AccountSwitchLabSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      accessToken: session.accessToken,
      account: session.account,
      accountId: session.accountId,
      displayName: session.displayName,
      identity: session.identity,
      needsProfileCompletion: session.needsProfileCompletion,
      primaryAccessGroup: session.primaryAccessGroup,
      refreshToken: session.refreshToken,
      slotGroup: session.slotGroup,
      userInfo: session.userInfo,
      version: 2,
    }),
  );
}
