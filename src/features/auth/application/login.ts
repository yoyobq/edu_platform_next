// src/features/auth/application/login.ts

import type { AuthPorts } from './ports';
import { restoreSession } from './restore-session';
import { setHydratingSession } from './session-store';
import type { AuthLoginInput, AuthPendingSession } from './types';

export async function login(ports: AuthPorts, input: AuthLoginInput): Promise<AuthPendingSession> {
  const pendingSession = await ports.api.login(input);

  ports.storage.writeSession(pendingSession);
  setHydratingSession(pendingSession);
  void restoreSession(ports, { background: true });

  return pendingSession;
}
