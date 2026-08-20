// src/features/auth/index.ts

import { getGraphQLClient } from '@/shared/graphql';

import { ensureFreshSession as runEnsureFreshSession } from './application/ensure-fresh-session';
import { forceLogout as runForceLogout } from './application/force-logout';
import { login as runLogin } from './application/login';
import {
  clearLocalAuthSession as runClearLocalAuthSession,
  logout as runLogout,
  revokeAuthSessionBestEffort as runRevokeAuthSessionBestEffort,
} from './application/logout';
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
export { isAuthPendingSession, resolvePrimaryAccessGroup } from './application/types';
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
export {
  AccountSwitchLabAccountMismatchError,
  type AccountSwitchLabIdentity,
  type AccountSwitchLabSession,
  canUseAccountSwitchLabSession,
  createAccountSwitchLabSession,
  isAccountSwitchLabAccountMismatchError,
  restoreAccountSwitchLabSession,
} from './infrastructure/account-switch-api';
export {
  type AccountSwitchLabRecord,
  readAccountSwitchLabRecords,
  readCurrentAuthSession,
  upsertAccountSwitchLabRecord,
  writeAccountSwitchLabRecords,
  writeCurrentAuthSession,
} from './infrastructure/account-switch-storage';
import {
  consumeExplicitLogoutRedirectHome,
  markExplicitLogoutRedirectHome,
} from './infrastructure/explicit-logout-redirect';
export { LoginForm } from './ui/login-form';
export {
  consumeExplicitLogoutRedirectHome,
  queueAuthRefreshFailureMessage,
  queueAuthRefreshRecoveredMessage,
  readAuthRefreshFeedbackFlash,
};

const authPorts: AuthPorts = {
  api: authApi,
  feedback: {
    queueRefreshFailureMessage: queueAuthRefreshFailureMessage,
  },
  storage: authStorage,
};

export function login(input: AuthLoginInput) {
  return runLogin(authPorts, input);
}

export function restoreSession(options?: { background?: boolean; waitForPending?: boolean }) {
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

export async function logout() {
  markExplicitLogoutRedirectHome();

  try {
    await runLogout(authPorts);
  } finally {
    try {
      await getGraphQLClient().clearStore();
    } catch {
      // Local auth cleanup must still complete when Apollo cache disposal fails.
    }
  }
}

export function clearLocalAuthSession() {
  return runClearLocalAuthSession(authPorts);
}

export function revokeAuthSessionBestEffort(input: { accessToken: string }) {
  return runRevokeAuthSessionBestEffort(authPorts, input);
}

export function forceLogout(reason?: string | null) {
  return runForceLogout(authPorts, reason);
}
