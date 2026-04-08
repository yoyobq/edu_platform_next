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

export type StaffInviteInfo = {
  description: string | null;
  expiresAt: string;
  invitedEmail: string;
  issuer: string | null;
  title: string | null;
};

export type StaffInviteIdentity = {
  expiresAt: string;
  orgId: string | null;
  personId: string;
  personName: string;
  upstreamLoginId: string;
  upstreamSessionToken: string;
};

export type StaffInviteIntentResult =
  | { invite: StaffInviteInfo; status: 'ready' }
  | { message: string; reason: VerificationFailureReason; status: 'failure' }
  | { message: string; status: 'error' };

export type StaffInviteIdentityResult =
  | { identity: StaffInviteIdentity; status: 'success' }
  | { message: string; status: 'error' };

export type StaffInviteConsumptionResult =
  | { accountId: number | null; status: 'success' }
  | { message: string; status: 'failure' }
  | { message: string; status: 'error' };
