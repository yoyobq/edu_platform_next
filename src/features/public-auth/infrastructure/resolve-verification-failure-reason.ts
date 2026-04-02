import type { VerificationFailureReason } from '../application/types';

export function mapVerificationFailureReason(
  reason: string | null | undefined,
): VerificationFailureReason {
  if (typeof reason !== 'string') {
    return 'unknown';
  }

  const normalizedReason = reason.toLowerCase();

  if (normalizedReason.includes('expired')) {
    return 'expired';
  }

  if (normalizedReason.includes('used') || normalizedReason.includes('consumed')) {
    return 'used';
  }

  if (
    normalizedReason.includes('invalid') ||
    normalizedReason.includes('revoked') ||
    normalizedReason.includes('revoke')
  ) {
    return 'invalid';
  }

  return 'unknown';
}

export function resolveVerificationFailureReason(error: unknown): VerificationFailureReason {
  if (!(error instanceof Error)) {
    return 'unknown';
  }

  return mapVerificationFailureReason(error.message);
}
