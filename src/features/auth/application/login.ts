// src/features/auth/application/login.ts

import type { AuthPorts } from './ports';
import { setAuthenticatedSession } from './session-store';
import type { AuthLoginInput, AuthSessionSnapshot } from './types';

export async function login(ports: AuthPorts, input: AuthLoginInput): Promise<AuthSessionSnapshot> {
  const snapshot = await ports.api.login(input);

  ports.storage.writeSession(snapshot);
  setAuthenticatedSession(snapshot);

  return snapshot;
}
