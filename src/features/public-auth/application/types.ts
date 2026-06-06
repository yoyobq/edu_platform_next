export type VerificationFailureReason = 'invalid' | 'expired' | 'used' | 'unknown';

export type PasswordResetIntentKind = 'legacy-user-password-reset' | 'password-reset';

export type PasswordResetPreview = {
  kind: PasswordResetIntentKind;
  loginEmailMasked: string | null;
  nickname: string | null;
};

export type InviteStatusReason = 'AVAILABLE' | 'CONSUMED' | 'EXPIRED' | 'INVALID';
export type PublicInviteRecordType = 'INVITE_STAFF';
export type PublicInviteType = 'staff';
export type StaffInviteStatusReason = InviteStatusReason;

export type VerificationIntentResult =
  | { passwordResetPreview?: PasswordResetPreview; status: 'valid' }
  | { status: 'invalid'; reason: VerificationFailureReason }
  | { status: 'expired'; reason: VerificationFailureReason }
  | { status: 'used'; reason: VerificationFailureReason };

export type ResetPasswordResult =
  | { status: 'success' }
  | { reason: Exclude<VerificationFailureReason, 'unknown'>; status: 'failure' }
  | { message: string; status: 'error' };

export type ChangeLoginEmailIntentResult =
  | {
      loginEmail: string | null;
      oldLoginEmail: string | null;
      status: 'ready';
    }
  | {
      reason: Exclude<VerificationFailureReason, 'unknown'>;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type ChangeLoginEmailConfirmResult =
  | {
      accountId: number | null;
      loginEmail: string | null;
      message: string | null;
      oldLoginEmail: string | null;
      status: 'success';
    }
  | {
      message: string;
      reason: Exclude<VerificationFailureReason, 'unknown'>;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type StaffInviteInfo = {
  canProceed: boolean;
  description: string | null;
  expiresAt: string;
  inviteUrl: string | null;
  invitedEmail: string;
  issuer: string | null;
  staffId: string;
  statusReason: StaffInviteStatusReason;
  title: string | null;
};

export type PublicInviteInfo = {
  canProceed: boolean;
  description: string | null;
  expiresAt: string;
  inviteUrl: string | null;
  invitedEmail: string;
  issuer: string | null;
  staffId: string | null;
  statusReason: InviteStatusReason;
  title: string | null;
  type: PublicInviteRecordType;
};

export type PublicInviteIntentResult =
  | { invite: PublicInviteInfo; status: 'ready' }
  | {
      invite: PublicInviteInfo | null;
      message: string;
      reason: VerificationFailureReason;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type StaffInviteIdentity = {
  departmentName: string | null;
  expiresAt: string;
  orgId: string | null;
  personId: string;
  personName: string;
  upstreamLoginId: string;
  upstreamSessionToken: string;
};

export type StaffInviteIntentResult =
  | { invite: StaffInviteInfo; status: 'ready' }
  | {
      invite: StaffInviteInfo | null;
      message: string;
      reason: VerificationFailureReason;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type StaffInviteIdentityResult =
  | { identity: StaffInviteIdentity; status: 'success' }
  | { message: string; status: 'error' };

export type StaffInviteConsumptionResult =
  | { accountId: number | null; status: 'success' }
  | { message: string; status: 'failure' }
  | { message: string; status: 'error' };

export type StudentRegistrationLinkReason =
  | 'AVAILABLE'
  | 'CLASS_NOT_FOUND'
  | 'LINK_EXPIRED'
  | 'LINK_NOT_ACTIVE'
  | 'LINK_NOT_FOUND'
  | 'LINK_REVOKED';

export type StudentRegistrationLinkScope = 'CLASS' | 'STUDENT';
export type StudentRegistrationLinkStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';

export type StudentRegistrationLinkInfo = {
  canProceed: boolean;
  classCode: string;
  className: string | null;
  expiresAt: string;
  scope: StudentRegistrationLinkScope;
  status: StudentRegistrationLinkStatus;
  studentId: string | null;
};

export type StudentRegistrationLinkInfoResult =
  | { info: StudentRegistrationLinkInfo; status: 'ready' }
  | {
      info: StudentRegistrationLinkInfo | null;
      message: string;
      reason: StudentRegistrationLinkReason;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type StudentRegistrationInput = {
  idCardLastSix: string;
  loginEmail: string;
  loginName?: string;
  loginPassword: string;
  name: string;
  nickname?: string;
  studentId: string;
  token: string;
};

export type StudentRegistrationIdentityVerificationInput = {
  idCardLastSix: string;
  name: string;
  studentId: string;
  token: string;
};

export type StudentRegistrationIdentityVerificationReason =
  | 'AVAILABLE'
  | 'CLASS_NOT_FOUND'
  | 'IDENTITY_MISMATCH'
  | 'LINK_EXPIRED'
  | 'LINK_NOT_ACTIVE'
  | 'LINK_NOT_FOUND'
  | 'LINK_REVOKED';

export type StudentRegistrationIdentityVerificationResult =
  | { canProceed: true; message: string | null; status: 'success' }
  | {
      canProceed: false;
      message: string;
      reason: StudentRegistrationIdentityVerificationReason;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type StudentRegistrationAccountVerificationInput = {
  loginName?: string;
  loginPassword: string;
  nickname?: string;
  token: string;
};

export type StudentRegistrationAccountVerificationReason =
  | 'AVAILABLE'
  | 'CLASS_NOT_FOUND'
  | 'LINK_EXPIRED'
  | 'LINK_NOT_ACTIVE'
  | 'LINK_NOT_FOUND'
  | 'LINK_REVOKED'
  | 'LOGIN_NAME_INVALID'
  | 'LOGIN_NAME_TAKEN'
  | 'NICKNAME_INVALID'
  | 'PASSWORD_INVALID';

export type StudentRegistrationAccountVerificationResult =
  | { canProceed: true; message: string | null; status: 'success' }
  | {
      canProceed: false;
      message: string;
      reason: StudentRegistrationAccountVerificationReason;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type StudentRegistrationConsumptionResult =
  | {
      accountId: number | null;
      accountStatus: string | null;
      emailVerificationRequired: boolean;
      emailVerificationSent: boolean;
      loginEmail: string;
      message: string | null;
      status: 'success';
    }
  | { message: string; status: 'identity-mismatch' }
  | { message: string; reason: StudentRegistrationLinkReason; status: 'link-failure' }
  | { message: string; status: 'failure' }
  | { message: string; status: 'error' };

export type LoginEmailVerificationReason = 'EXPIRED' | 'INVALID' | 'USED';

export type LoginEmailVerificationResult =
  | {
      accountId: number | null;
      loginEmail: string | null;
      message: string | null;
      status: 'success';
    }
  | {
      loginEmail: string | null;
      message: string;
      reason: LoginEmailVerificationReason;
      status: 'failure';
    }
  | { message: string; status: 'error' };

export type ResendLoginEmailVerificationResult =
  | { message: string | null; status: 'success' }
  | { message: string; status: 'error' };
