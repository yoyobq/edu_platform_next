import type { AuthPorts } from './ports';
import { getAuthSessionState, setAuthenticatedSession } from './session-store';
import type { AuthSessionSnapshot } from './types';

let refreshPromise: Promise<AuthSessionSnapshot> | null = null;

export function refreshSessionWithLock(
  ports: AuthPorts,
  refreshToken: string,
): Promise<AuthSessionSnapshot> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshedSnapshot = await ports.api.refresh({
      refreshToken,
    });

    ports.storage.writeSession(refreshedSnapshot);
    setAuthenticatedSession(refreshedSnapshot);

    return refreshedSnapshot;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function refreshSession(ports: AuthPorts): Promise<AuthSessionSnapshot> {
  const currentSession = getAuthSessionState().snapshot ?? ports.storage.readSession();

  if (!currentSession) {
    throw new Error('当前没有可刷新的登录会话。');
  }

  return refreshSessionWithLock(ports, currentSession.refreshToken);
}
