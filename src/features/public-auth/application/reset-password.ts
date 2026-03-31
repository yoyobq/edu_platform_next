import type { PublicAuthPorts } from './ports';
import type { ResetPasswordResult } from './types';

export async function resetPassword(
  ports: PublicAuthPorts,
  input: { newPassword: string; verificationCode: string },
): Promise<ResetPasswordResult> {
  return ports.api.resetPassword(input);
}
