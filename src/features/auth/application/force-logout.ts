// src/features/auth/application/force-logout.ts

import type { AuthPorts } from './ports';
import { setUnauthenticatedSession } from './session-store';

export function forceLogout(ports: AuthPorts, reason = '当前会话已失效，请重新登录。') {
  ports.storage.clearSession();
  setUnauthenticatedSession(reason);
}
