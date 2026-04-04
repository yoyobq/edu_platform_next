import type { AuthPorts } from './ports';
import { getAuthSessionState, setAuthenticatedSession } from './session-store';
import type { AuthSessionSnapshot } from './types';

export async function refreshSession(ports: AuthPorts): Promise<AuthSessionSnapshot> {
  const currentSession = getAuthSessionState().snapshot ?? ports.storage.readSession();

  if (!currentSession) {
    throw new Error('当前没有可刷新的登录会话。');
  }

  const refreshedSnapshot = await ports.api.refresh({
    refreshToken: currentSession.refreshToken,
  });

  ports.storage.writeSession(refreshedSnapshot);
  setAuthenticatedSession(refreshedSnapshot);

  return refreshedSnapshot;
}
