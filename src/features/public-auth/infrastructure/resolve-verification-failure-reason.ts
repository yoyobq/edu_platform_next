import type { VerificationFailureReason } from '../application/types';

export function resolveVerificationFailureReason(error: unknown): VerificationFailureReason {
  if (!(error instanceof Error)) {
    return 'unknown';
  }

  const message = error.message.toLowerCase();

  if (message.includes('expired')) {
    return 'expired';
  }

  if (message.includes('consumed') || message.includes('used')) {
    return 'used';
  }

  if (message.includes('invalid') || message.includes('revoke')) {
    return 'invalid';
  }

  return 'unknown';
}
