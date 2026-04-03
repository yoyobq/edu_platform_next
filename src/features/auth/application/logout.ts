// src/features/auth/application/logout.ts

import type { AuthPorts } from './ports';
import { getAuthSessionSnapshot, setUnauthenticatedSession } from './session-store';

export async function logout(ports: AuthPorts) {
  const session = getAuthSessionSnapshot();

  try {
    await ports.api.logout(session);
  } catch {
    // 即使后台注销失败，也不保留本地失效会话。
  } finally {
    ports.storage.clearSession();
    setUnauthenticatedSession();
  }
}
