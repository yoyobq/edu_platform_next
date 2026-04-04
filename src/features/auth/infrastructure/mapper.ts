// src/features/auth/infrastructure/mapper.ts

import {
  type AuthAccessGroup,
  type AuthSessionIdentity,
  type AuthSessionSnapshot,
  type AuthSlotGroup,
  isAuthAccessGroup,
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
        accountId: number;
        createdAt: string;
        departmentId: string | null;
        employmentStatus: string;
        id: string;
        jobTitle: string | null;
        name: string;
        remark: string | null;
        updatedAt: string;
      }
    | {
        __typename: 'StudentType';
        accountId: number;
        classId: number | null;
        createdAt: string;
        id: string;
        name: string;
        remarks: string | null;
        studentDepartmentId: string;
        studentStatus: string;
        updatedAt: string;
      }
    | null;
  needsProfileCompletion: boolean;
  userInfo: {
    accessGroup: unknown;
    avatarUrl: unknown;
    email: unknown;
    nickname: unknown;
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

type ParsedAccessTokenClaims = {
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly AuthSlotGroup[];
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

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');

  return atob(paddedValue);
}

function parseAccessTokenClaims(accessToken: string): ParsedAccessTokenClaims {
  const [, payloadSegment] = accessToken.split('.');

  if (!payloadSegment) {
    return {
      accessGroup: [],
      slotGroup: [],
    };
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as {
      accessGroup?: unknown;
      slotGroup?: unknown;
    };

    return {
      accessGroup: normalizeAccessGroup(payload.accessGroup),
      slotGroup: normalizeSlotGroup(payload.slotGroup),
    };
  } catch {
    return {
      accessGroup: [],
      slotGroup: [],
    };
  }
}

function normalizeIdentity(value: AuthSessionResultDTO['identity']): AuthSessionIdentity | null {
  if (!value) {
    return null;
  }

  if (value.__typename === 'StaffType') {
    return {
      kind: 'STAFF',
      accountId: value.accountId,
      createdAt: value.createdAt,
      departmentId: value.departmentId,
      employmentStatus: value.employmentStatus,
      id: value.id,
      jobTitle: value.jobTitle,
      name: value.name,
      remark: value.remark,
      updatedAt: value.updatedAt,
    };
  }

  return {
    kind: 'STUDENT',
    accountId: value.accountId,
    classId: value.classId,
    createdAt: value.createdAt,
    departmentId: value.studentDepartmentId,
    id: value.id,
    name: value.name,
    remarks: value.remarks,
    studentStatus: value.studentStatus,
    updatedAt: value.updatedAt,
  };
}

function resolveDisplayName(input: {
  account: AuthSessionResultDTO['account'];
  identity: AuthSessionIdentity | null;
  nickname: string | null;
  primaryAccessGroup: AuthAccessGroup;
}) {
  if (input.nickname) {
    return input.nickname;
  }

  if (input.identity?.name) {
    return input.identity.name;
  }

  return normalizeOptionalString(input.account.loginName) || input.primaryAccessGroup.toLowerCase();
}

export function mapSessionResultToSessionSnapshot(
  tokens: AuthSessionTokensDTO,
  session: AuthSessionResultDTO,
): AuthSessionSnapshot {
  const parsedClaims = parseAccessTokenClaims(tokens.accessToken);
  const identity = normalizeIdentity(session.identity);
  const accessGroup = normalizeAccessGroup(session.userInfo.accessGroup);
  const effectiveAccessGroup = accessGroup.length > 0 ? accessGroup : parsedClaims.accessGroup;
  const primaryAccessGroup = resolvePrimaryAccessGroup({
    accessGroup: effectiveAccessGroup,
    identity,
  });
  const nickname = normalizeOptionalString(session.userInfo.nickname);

  return {
    accessToken: tokens.accessToken,
    account: {
      id: session.account.id,
      identityHint: isAuthAccessGroup(session.account.identityHint)
        ? session.account.identityHint
        : null,
      loginEmail: normalizeOptionalString(session.account.loginEmail),
      loginName: normalizeOptionalString(session.account.loginName),
      status: typeof session.account.status === 'string' ? session.account.status : 'ACTIVE',
    },
    accountId: session.accountId,
    displayName: resolveDisplayName({
      account: session.account,
      identity,
      nickname,
      primaryAccessGroup,
    }),
    identity,
    isAuthenticated: true,
    needsProfileCompletion: session.needsProfileCompletion === true,
    primaryAccessGroup,
    refreshToken: tokens.refreshToken,
    slotGroup: parsedClaims.slotGroup,
    userInfo: {
      accessGroup: effectiveAccessGroup,
      avatarUrl: normalizeOptionalString(session.userInfo.avatarUrl),
      email: normalizeOptionalString(session.userInfo.email),
      nickname: nickname ?? primaryAccessGroup.toLowerCase(),
    },
  };
}

export function serializeSessionSnapshot(snapshot: AuthSessionSnapshot): string {
  const persistedSession: PersistedAuthSessionDTO = {
    accessToken: snapshot.accessToken,
    account: snapshot.account,
    accountId: snapshot.accountId,
    displayName: snapshot.displayName,
    identity: snapshot.identity,
    needsProfileCompletion: snapshot.needsProfileCompletion,
    primaryAccessGroup: snapshot.primaryAccessGroup,
    refreshToken: snapshot.refreshToken,
    slotGroup: snapshot.slotGroup,
    userInfo: snapshot.userInfo,
    version: 2,
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
    identity:
      value.identity && typeof value.identity === 'object' && 'kind' in value.identity
        ? (value.identity as AuthSessionIdentity)
        : null,
    isAuthenticated: true,
    needsProfileCompletion: value.needsProfileCompletion,
    primaryAccessGroup: isAuthAccessGroup(value.primaryAccessGroup)
      ? value.primaryAccessGroup
      : resolvePrimaryAccessGroup({
          accessGroup,
          identity:
            value.identity && typeof value.identity === 'object' && 'kind' in value.identity
              ? (value.identity as AuthSessionIdentity)
              : null,
        }),
    refreshToken: value.refreshToken,
    slotGroup: normalizeSlotGroup(value.slotGroup),
    userInfo: {
      accessGroup,
      avatarUrl: normalizeOptionalString(value.userInfo.avatarUrl),
      email: normalizeOptionalString(value.userInfo.email),
      nickname:
        normalizeOptionalString(value.userInfo.nickname) ??
        resolvePrimaryAccessGroup({
          accessGroup,
          identity:
            value.identity && typeof value.identity === 'object' && 'kind' in value.identity
              ? (value.identity as AuthSessionIdentity)
              : null,
        }).toLowerCase(),
    },
  };
}
