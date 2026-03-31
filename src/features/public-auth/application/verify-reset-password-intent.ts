import type { PublicAuthPorts } from './ports';
import type { VerificationIntentResult } from './types';

export async function verifyResetPasswordIntent(
  ports: PublicAuthPorts,
  input: { verificationCode: string },
): Promise<VerificationIntentResult> {
  return ports.api.verifyResetPasswordIntent(input);
}
