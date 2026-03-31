import type { VerificationIntentResult } from '../application/types';

type VerificationRecordStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';

export function mapVerificationRecordToIntentResult(input: {
  notBefore?: string | null;
  status: VerificationRecordStatus;
}): VerificationIntentResult {
  if (input.notBefore) {
    const availableAt = Date.parse(input.notBefore);

    if (Number.isFinite(availableAt) && availableAt > Date.now()) {
      return {
        status: 'invalid',
        reason: 'invalid',
      };
    }
  }

  if (input.status === 'ACTIVE') {
    return { status: 'valid' };
  }

  if (input.status === 'EXPIRED') {
    return {
      status: 'expired',
      reason: 'expired',
    };
  }

  if (input.status === 'CONSUMED') {
    return {
      status: 'used',
      reason: 'used',
    };
  }

  return {
    status: 'invalid',
    reason: 'invalid',
  };
}
