// src/features/auth/application/types.ts

import type { AuthAccessGroup } from '@/shared/auth-access';

export type { AuthAccessGroup } from '@/shared/auth-access';
export { AUTH_ACCESS_GROUPS, isAuthAccessGroup } from '@/shared/auth-access';

export type AuthSlotGroup = string;

export type AuthSessionIdentity =
  | {
      kind: 'STAFF';
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
      kind: 'STUDENT';
      accountId: number;
      classId: number | null;
      createdAt: string;
      id: string;
      name: string;
      remarks: string | null;
      studentStatus: string;
      updatedAt: string;
    };

export type AuthSessionAccount = {
  id: number;
  identityHint: AuthAccessGroup | null;
  loginEmail: string | null;
  loginName: string | null;
  status: string;
};

export type AuthSessionUserInfo = {
  accessGroup: readonly AuthAccessGroup[];
  avatarUrl: string | null;
  email: string | null;
  nickname: string;
};

export type AuthStatus = 'restoring' | 'hydrating' | 'authenticated' | 'unauthenticated';

export type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthPendingSession = AuthSessionTokens & {
  kind: 'PENDING';
};

export type AuthSessionSnapshot = AuthSessionTokens & {
  account: AuthSessionAccount;
  accountId: number;
  displayName: string;
  identity: AuthSessionIdentity | null;
  isAuthenticated: true;
  needsProfileCompletion: boolean;
  primaryAccessGroup: AuthAccessGroup;
  refreshToken: string;
  slotGroup: readonly AuthSlotGroup[];
  userInfo: AuthSessionUserInfo;
};

export type AuthStoredSession = AuthPendingSession | AuthSessionSnapshot;

export type AuthSessionState = {
  lastError: string | null;
  pendingSession: AuthPendingSession | null;
  snapshot: AuthSessionSnapshot | null;
  status: AuthStatus;
};

export type AuthLoginInput = {
  audience: 'DESKTOP';
  ip?: string | null;
  loginName: string;
  loginPassword: string;
  type: 'PASSWORD';
};

export function isAuthPendingSession(
  value: AuthStoredSession | AuthPendingSession | null | undefined,
): value is AuthPendingSession {
  return Boolean(value && 'kind' in value && value.kind === 'PENDING');
}

export function resolvePrimaryAccessGroup(input: {
  accessGroup: readonly AuthAccessGroup[];
  identity: AuthSessionIdentity | null;
}): AuthAccessGroup {
  if (input.identity?.kind === 'STAFF') {
    return 'STAFF';
  }

  if (input.identity?.kind === 'STUDENT') {
    return 'STUDENT';
  }

  if (input.accessGroup.includes('GUEST')) {
    return 'GUEST';
  }

  if (input.accessGroup.includes('REGISTRANT')) {
    return 'REGISTRANT';
  }

  if (input.accessGroup.includes('ADMIN')) {
    return 'ADMIN';
  }

  if (input.accessGroup.includes('STAFF')) {
    return 'STAFF';
  }

  if (input.accessGroup.includes('STUDENT')) {
    return 'STUDENT';
  }

  return 'GUEST';
}

export function getSessionAccessGroup(snapshot: AuthSessionSnapshot | null | undefined) {
  return snapshot?.userInfo.accessGroup ?? [];
}

export function hasAdminAccess(snapshot: AuthSessionSnapshot | null | undefined) {
  return getSessionAccessGroup(snapshot).includes('ADMIN');
}
