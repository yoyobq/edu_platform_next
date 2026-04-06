import type { AuthPorts } from './ports';
import { getAuthSessionSnapshot, setAuthenticatedSession } from './session-store';
import type { AuthSessionSnapshot } from './types';

const REFRESH_THRESHOLD_MS = 60_000;

let ensureFreshPromise: Promise<AuthSessionSnapshot> | null = null;

function getAccessTokenExpiresAt(accessToken: string): number | null {
  const [, payloadSegment] = accessToken.split('.');

  if (!payloadSegment) {
    return null;
  }

  try {
    const raw = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };

    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenFresh(accessToken: string): boolean {
  const expiresAt = getAccessTokenExpiresAt(accessToken);

  if (expiresAt === null) {
    return true;
  }

  return expiresAt - Date.now() > REFRESH_THRESHOLD_MS;
}

export async function ensureFreshSession(ports: AuthPorts): Promise<AuthSessionSnapshot> {
  const snapshot = getAuthSessionSnapshot() ?? ports.storage.readSession();

  if (!snapshot) {
    throw new Error('当前没有可用的登录会话。');
  }

  if (isTokenFresh(snapshot.accessToken)) {
    return snapshot;
  }

  if (ensureFreshPromise) {
    return ensureFreshPromise;
  }

  ensureFreshPromise = (async () => {
    const refreshedSnapshot = await ports.api.refresh({
      refreshToken: snapshot.refreshToken,
    });

    ports.storage.writeSession(refreshedSnapshot);
    setAuthenticatedSession(refreshedSnapshot);

    return refreshedSnapshot;
  })().finally(() => {
    ensureFreshPromise = null;
  });

  return ensureFreshPromise;
}
