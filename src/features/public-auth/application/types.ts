export type VerificationFailureReason = 'invalid' | 'expired' | 'used' | 'unknown';

export type VerificationIntentResult =
  | { status: 'valid' }
  | { status: 'invalid'; reason: VerificationFailureReason }
  | { status: 'expired'; reason: VerificationFailureReason }
  | { status: 'used'; reason: VerificationFailureReason };

export type ResetPasswordResult =
  | { status: 'success' }
  | { reason: Exclude<VerificationFailureReason, 'unknown'>; status: 'failure' }
  | { message: string; status: 'error' };
