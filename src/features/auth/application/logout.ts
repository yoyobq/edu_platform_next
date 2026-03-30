// src/features/auth/application/logout.ts

import type { AuthPorts } from './ports';
import { setUnauthenticatedSession } from './session-store';

export function logout(ports: AuthPorts) {
  ports.storage.clearSession();
  setUnauthenticatedSession();
}
