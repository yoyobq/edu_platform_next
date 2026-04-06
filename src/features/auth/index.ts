// src/features/auth/index.ts

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
  getAuthSessionSnapshot,
  getAuthSessionState,
  useAuthSessionState,
} from './application/session-store';
export type {
  AuthAccessGroup,
  AuthLoginInput,
  AuthSessionIdentity,
  AuthSessionSnapshot,
  AuthSessionState,
  AuthSessionUserInfo,
  AuthStatus,
} from './application/types';
export {
  getSessionAccessGroup,
  hasAdminAccess,
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
import { authStorage } from './infrastructure/auth-storage';
export { LoginForm } from './ui/login-form';

const authPorts: AuthPorts = {
  api: authApi,
  storage: authStorage,
};

export function login(input: AuthLoginInput) {
  return runLogin(authPorts, input);
}

export function restoreSession() {
  return runRestoreSession(authPorts);
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

export function forceLogout(reason?: string) {
  return runForceLogout(authPorts, reason);
}
