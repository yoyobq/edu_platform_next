// src/features/auth/application/logout.ts

import type { AuthPorts } from './ports';
import { getCurrentAuthSession, setUnauthenticatedSession } from './session-store';
import type { AuthStoredSession } from './types';

const LOGOUT_BEST_EFFORT_TIMEOUT_MS = 1500;

async function waitForBestEffortLogout(logoutPromise: Promise<void>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const guardedLogoutPromise = logoutPromise.catch(() => undefined);
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, LOGOUT_BEST_EFFORT_TIMEOUT_MS);
  });

  try {
    await Promise.race([guardedLogoutPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function clearLocalAuthSession(ports: AuthPorts) {
  ports.storage.clearSession();
  setUnauthenticatedSession();
}

async function revokeAuthSession(
  ports: AuthPorts,
  session: Pick<AuthStoredSession, 'accessToken'> | null | undefined,
) {
  if (!session?.accessToken) {
    return;
  }

  await waitForBestEffortLogout(ports.api.logout({ accessToken: session.accessToken }));
}

export async function logout(ports: AuthPorts) {
  const currentSession = getCurrentAuthSession() ?? ports.storage.readSession();

  try {
    await revokeAuthSession(ports, currentSession);
  } finally {
    clearLocalAuthSession(ports);
  }
}
