// src/features/auth/infrastructure/mapper.ts

import {
  type AuthAccessGroup,
  type AuthPendingSession,
  type AuthSessionIdentity,
  type AuthSessionSnapshot,
  type AuthSlotGroup,
  type AuthStoredSession,
  isAuthAccessGroup,
  isAuthPendingSession,
  resolvePrimaryAccessGroup,
} from '../application/types';

type AuthSessionTokensDTO = {
  accessToken: string;
  refreshToken: string;
};

type AuthSessionResultDTO = {
  account: {
    id: number;
    identityHint: unknown;
    loginEmail: unknown;
    loginName: unknown;
    status: unknown;
  };
  accountId: number;
  identity:
    | {
        __typename: 'StaffType';
        departmentId: unknown;
        id: unknown;
        name: unknown;
        slotGroup: unknown;
      }
    | {
        __typename: 'StudentType';
        currentClassCode: unknown;
        currentClassId: unknown;
        id: unknown;
        name: unknown;
        slotGroup: unknown;
        upstreamId: unknown;
      }
    | null;
  needsProfileCompletion: boolean;
  userInfo: {
    accessGroup: unknown;
    avatarUrl: unknown;
    email: unknown;
    nickname: unknown;
    signature: unknown;
    tags: unknown;
  };
};

type PersistedAuthSessionDTO = {
  accessToken: string;
  account: AuthSessionSnapshot['account'];
  accountId: number;
  displayName: string;
  identity: AuthSessionIdentity | null;
  needsProfileCompletion: boolean;
  primaryAccessGroup: AuthAccessGroup;
  refreshToken: string;
  slotGroup: readonly AuthSlotGroup[];
  userInfo: AuthSessionSnapshot['userInfo'];
  version: 2;
};

type PersistedPendingAuthSessionDTO = {
  accessToken: string;
  refreshToken: string;
  stage: 'pending';
  version: 3;
};

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeAccessGroup(value: unknown): readonly AuthAccessGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAuthAccessGroup);
}

function normalizeSlotGroup(value: unknown): readonly AuthSlotGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is AuthSlotGroup => typeof item === 'string' && item.trim().length > 0,
  );
}

function normalizeStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()),
    ),
  ).filter((item) => item.length > 0);
}

function normalizeIdentity(value: AuthSessionResultDTO['identity']): AuthSessionIdentity | null {
  if (!value) {
    return null;
  }

  if (value.__typename === 'StaffType') {
    return {
      kind: 'STAFF',
      departmentId: normalizeOptionalString(value.departmentId),
      id: normalizeOptionalString(value.id) ?? '',
      name: normalizeOptionalString(value.name),
      slotGroup: normalizeSlotGroup(value.slotGroup),
    };
  }

  return {
    kind: 'STUDENT',
    currentClassCode: normalizeOptionalString(value.currentClassCode),
    currentClassId: normalizeOptionalString(value.currentClassId),
    id: normalizeOptionalString(value.id) ?? '',
    name: normalizeOptionalString(value.name),
    slotGroup: normalizeSlotGroup(value.slotGroup),
    upstreamId: normalizeOptionalString(value.upstreamId),
  };
}

function normalizePersistedIdentity(value: unknown): AuthSessionIdentity | null {
  if (!value || typeof value !== 'object' || !('kind' in value)) {
    return null;
  }

  const identity = value as Record<string, unknown>;

  if (identity.kind === 'STAFF') {
    return {
      kind: 'STAFF',
      departmentId: normalizeOptionalString(identity.departmentId),
      id: normalizeOptionalString(identity.id) ?? '',
      name: normalizeOptionalString(identity.name),
      slotGroup: normalizeSlotGroup(identity.slotGroup),
    };
  }

  if (identity.kind === 'STUDENT') {
    return {
      kind: 'STUDENT',
      currentClassCode: normalizeOptionalString(identity.currentClassCode),
      currentClassId: normalizeOptionalString(identity.currentClassId),
      id: normalizeOptionalString(identity.id) ?? '',
      name: normalizeOptionalString(identity.name),
      slotGroup: normalizeSlotGroup(identity.slotGroup),
      upstreamId: normalizeOptionalString(identity.upstreamId),
    };
  }

  return null;
}

function resolveSessionSlotGroup(identity: AuthSessionIdentity | null): readonly AuthSlotGroup[] {
  return identity?.slotGroup ?? [];
}

function resolveDisplayName(input: { accountId: number; identity: AuthSessionIdentity | null }) {
  return input.identity?.name ?? `account-${input.accountId}`;
}

export function mapSessionResultToSessionSnapshot(
  tokens: AuthSessionTokensDTO,
  session: AuthSessionResultDTO,
): AuthSessionSnapshot {
  const identity = normalizeIdentity(session.identity);
  const accessGroup = normalizeAccessGroup(session.userInfo.accessGroup);
  const primaryAccessGroup = resolvePrimaryAccessGroup({
    accessGroup,
    identity,
  });
  const displayName = resolveDisplayName({
    accountId: session.accountId,
    identity,
  });
  const nickname = normalizeOptionalString(session.userInfo.nickname) ?? '';

  return {
    accessToken: tokens.accessToken,
    account: {
      id: session.account.id,
      identityHint: isAuthAccessGroup(session.account.identityHint)
        ? session.account.identityHint
        : null,
      loginEmail: normalizeOptionalString(session.account.loginEmail),
      loginName: normalizeOptionalString(session.account.loginName),
      status: normalizeOptionalString(session.account.status) ?? 'ACTIVE',
    },
    accountId: session.accountId,
    displayName,
    identity,
    isAuthenticated: true,
    needsProfileCompletion: session.needsProfileCompletion === true,
    primaryAccessGroup,
    refreshToken: tokens.refreshToken,
    slotGroup: resolveSessionSlotGroup(identity),
    userInfo: {
      accessGroup,
      avatarUrl: normalizeOptionalString(session.userInfo.avatarUrl),
      email: normalizeOptionalString(session.userInfo.email),
      nickname,
      signature: normalizeOptionalString(session.userInfo.signature),
      tags: normalizeStringList(session.userInfo.tags),
    },
  };
}

export function mapTokensToPendingSession(tokens: AuthSessionTokensDTO): AuthPendingSession {
  return {
    accessToken: tokens.accessToken,
    kind: 'PENDING',
    refreshToken: tokens.refreshToken,
  };
}

export function serializeStoredSession(session: AuthStoredSession): string {
  if (isAuthPendingSession(session)) {
    const pendingSession: PersistedPendingAuthSessionDTO = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      stage: 'pending',
      version: 3,
    };

    return JSON.stringify(pendingSession);
  }

  const persistedSession: PersistedAuthSessionDTO = {
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
  };

  return JSON.stringify(persistedSession);
}

export function deserializeStoredSession(rawValue: string): AuthStoredSession | null {
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
    (parsedValue as Partial<PersistedPendingAuthSessionDTO>).version === 3 &&
    (parsedValue as Partial<PersistedPendingAuthSessionDTO>).stage === 'pending' &&
    typeof (parsedValue as Partial<PersistedPendingAuthSessionDTO>).accessToken === 'string' &&
    typeof (parsedValue as Partial<PersistedPendingAuthSessionDTO>).refreshToken === 'string'
  ) {
    return {
      accessToken: (parsedValue as PersistedPendingAuthSessionDTO).accessToken,
      kind: 'PENDING',
      refreshToken: (parsedValue as PersistedPendingAuthSessionDTO).refreshToken,
    };
  }

  if (
    value.version !== 2 ||
    typeof value.accessToken !== 'string' ||
    typeof value.refreshToken !== 'string' ||
    typeof value.accountId !== 'number' ||
    typeof value.displayName !== 'string' ||
    typeof value.needsProfileCompletion !== 'boolean' ||
    !value.account ||
    !value.userInfo
  ) {
    return null;
  }

  const accessGroup = normalizeAccessGroup(value.userInfo.accessGroup);
  const identity = normalizePersistedIdentity(value.identity);
  const slotGroup = normalizeSlotGroup(value.slotGroup);

  return {
    accessToken: value.accessToken,
    account: {
      id: typeof value.account.id === 'number' ? value.account.id : value.accountId,
      identityHint: isAuthAccessGroup(value.account.identityHint)
        ? value.account.identityHint
        : null,
      loginEmail: normalizeOptionalString(value.account.loginEmail),
      loginName: normalizeOptionalString(value.account.loginName),
      status: typeof value.account.status === 'string' ? value.account.status : 'ACTIVE',
    },
    accountId: value.accountId,
    displayName: value.displayName.trim() || 'guest',
    identity,
    isAuthenticated: true,
    needsProfileCompletion: value.needsProfileCompletion,
    primaryAccessGroup: isAuthAccessGroup(value.primaryAccessGroup)
      ? value.primaryAccessGroup
      : resolvePrimaryAccessGroup({
          accessGroup,
          identity,
        }),
    refreshToken: value.refreshToken,
    slotGroup,
    userInfo: {
      accessGroup,
      avatarUrl: normalizeOptionalString(value.userInfo.avatarUrl),
      email: normalizeOptionalString(value.userInfo.email),
      nickname:
        normalizeOptionalString(value.userInfo.nickname) ??
        resolvePrimaryAccessGroup({
          accessGroup,
          identity,
        }).toLowerCase(),
      signature: normalizeOptionalString(value.userInfo.signature),
      tags: normalizeStringList(value.userInfo.tags),
    },
  };
}
