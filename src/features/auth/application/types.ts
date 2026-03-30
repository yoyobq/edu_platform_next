// src/features/auth/application/types.ts

export type AuthIdentityType =
  | 'ADMIN'
  | 'COACH'
  | 'CUSTOMER'
  | 'GUEST'
  | 'LEARNER'
  | 'MANAGER'
  | 'REGISTRANT'
  | 'STAFF'
  | 'STUDENT';

export type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

export type AuthSessionSnapshot = {
  accessGroup: readonly AuthIdentityType[];
  accessToken: string;
  accountId: number;
  avatarUrl: string | null;
  displayName: string;
  isAuthenticated: true;
  refreshToken: string;
  role: AuthIdentityType;
};

export type AuthSessionState = {
  lastError: string | null;
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
