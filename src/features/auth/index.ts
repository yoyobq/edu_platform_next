// src/features/auth/index.ts

export type { AuthAccessGroup } from '@/shared/auth-access';
export { AUTH_ACCESS_GROUPS, isAuthAccessGroup } from '@/shared/auth-access';

import { ensureFreshSession as runEnsureFreshSession } from './application/ensure-fresh-session';
import { forceLogout as runForceLogout } from './application/force-logout';
import { login as runLogin } from './application/login';
import { logout as runLogout } from './application/logout';
import type { AuthPorts } from './application/ports';
import {
  buildWelcomeRedirectTarget,
  resolveAuthenticatedRedirectTarget,
  resolveLoginRedirectTarget,
  resolveWelcomeRedirectTarget,
} from './application/redirect-target';
import { refreshSession as runRefreshSession } from './application/refresh-session';
import { restoreSession as runRestoreSession } from './application/restore-session';
export {
  getAuthPendingSession,
  getAuthSessionSnapshot,
  getAuthSessionState,
  getCurrentAuthSession,
  useAuthSessionState,
} from './application/session-store';
export type {
  AuthLoginInput,
  AuthPendingSession,
  AuthSessionIdentity,
  AuthSessionSnapshot,
  AuthSessionState,
  AuthSessionUserInfo,
  AuthStatus,
  AuthStoredSession,
} from './application/types';
export {
  getSessionAccessGroup,
  hasAdminAccess,
  isAuthPendingSession,
  resolvePrimaryAccessGroup,
} from './application/types';
export {
  buildWelcomeRedirectTarget,
  resolveAuthenticatedRedirectTarget,
  resolveLoginRedirectTarget,
  resolveWelcomeRedirectTarget,
};
import type { AuthLoginInput } from './application/types';
import { authApi } from './infrastructure/auth-api';
import {
  queueAuthRefreshFailureMessage,
  queueAuthRefreshRecoveredMessage,
  readAuthRefreshFeedbackFlash,
} from './infrastructure/auth-refresh-feedback';
import { authStorage } from './infrastructure/auth-storage';
export { LoginForm } from './ui/login-form';
export {
  queueAuthRefreshFailureMessage,
  queueAuthRefreshRecoveredMessage,
  readAuthRefreshFeedbackFlash,
};

const authPorts: AuthPorts = {
  api: authApi,
  storage: authStorage,
};

export function login(input: AuthLoginInput) {
  return runLogin(authPorts, input);
}

export function restoreSession(options?: { background?: boolean }) {
  return runRestoreSession(authPorts, options);
}

export function readStoredAuthSession() {
  return authStorage.readSession();
}

export function ensureFreshSession(options?: { force?: boolean }) {
  return runEnsureFreshSession(authPorts, options);
}

export function refreshSession() {
  return runRefreshSession(authPorts);
}

export function logout() {
  return runLogout(authPorts);
}

export function forceLogout(reason?: string | null) {
  return runForceLogout(authPorts, reason);
}
