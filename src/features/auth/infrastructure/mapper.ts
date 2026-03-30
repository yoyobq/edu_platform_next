// src/features/auth/infrastructure/mapper.ts

import type { AuthSessionSnapshot } from '../application/types';

type AuthIdentityType = AuthSessionSnapshot['role'];

type AuthLoginResultDTO = {
  accessToken: string;
  accountId: number;
  refreshToken: string;
  role: AuthIdentityType;
  userInfo: {
    accessGroup: readonly AuthIdentityType[];
    avatarUrl: string | null;
    nickname: string | null;
  } | null;
};

type PersistedAuthSessionDTO = {
  accessGroup: readonly AuthIdentityType[];
  accessToken: string;
  accountId: number;
  avatarUrl: string | null;
  displayName: string;
  refreshToken: string;
  role: AuthIdentityType;
  version: 1;
};

const AUTH_IDENTITY_TYPES: ReadonlySet<string> = new Set([
  'ADMIN',
  'COACH',
  'CUSTOMER',
  'GUEST',
  'LEARNER',
  'MANAGER',
  'REGISTRANT',
  'STAFF',
  'STUDENT',
]);

function normalizeIdentityType(value: unknown): AuthIdentityType | null {
  return typeof value === 'string' && AUTH_IDENTITY_TYPES.has(value)
    ? (value as AuthIdentityType)
    : null;
}

function normalizeAccessGroup(value: unknown): readonly AuthIdentityType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeIdentityType(item))
    .filter((item): item is AuthIdentityType => item !== null);
}

function normalizeDisplayName(
  userInfo: AuthLoginResultDTO['userInfo'],
  role: AuthIdentityType,
): string {
  if (userInfo?.nickname && userInfo.nickname.trim()) {
    return userInfo.nickname.trim();
  }

  return role.toLowerCase();
}

export function mapLoginResultToSessionSnapshot(result: AuthLoginResultDTO): AuthSessionSnapshot {
  const accessGroup =
    result.userInfo?.accessGroup && result.userInfo.accessGroup.length > 0
      ? result.userInfo.accessGroup
      : [result.role];

  return {
    accessGroup,
    accessToken: result.accessToken,
    accountId: result.accountId,
    avatarUrl: result.userInfo?.avatarUrl ?? null,
    displayName: normalizeDisplayName(result.userInfo, result.role),
    isAuthenticated: true,
    refreshToken: result.refreshToken,
    role: result.role,
  };
}

export function serializeSessionSnapshot(snapshot: AuthSessionSnapshot): string {
  const persistedSession: PersistedAuthSessionDTO = {
    accessGroup: snapshot.accessGroup,
    accessToken: snapshot.accessToken,
    accountId: snapshot.accountId,
    avatarUrl: snapshot.avatarUrl,
    displayName: snapshot.displayName,
    refreshToken: snapshot.refreshToken,
    role: snapshot.role,
    version: 1,
  };

  return JSON.stringify(persistedSession);
}

export function deserializeSessionSnapshot(rawValue: string): AuthSessionSnapshot | null {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!parsedValue || typeof parsedValue !== 'object') {
    return null;
  }

  const value = parsedValue as Partial<PersistedAuthSessionDTO>;

  if (
    value.version !== 1 ||
    typeof value.accessToken !== 'string' ||
    typeof value.refreshToken !== 'string' ||
    typeof value.accountId !== 'number' ||
    typeof value.displayName !== 'string'
  ) {
    return null;
  }

  const role = normalizeIdentityType(value.role);

  if (!role) {
    return null;
  }

  return {
    accessGroup: normalizeAccessGroup(value.accessGroup),
    accessToken: value.accessToken,
    accountId: value.accountId,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : null,
    displayName: value.displayName.trim() || role.toLowerCase(),
    isAuthenticated: true,
    refreshToken: value.refreshToken,
    role,
  };
}
