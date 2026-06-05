import type {
  ChangeLoginEmailConfirmResult,
  ChangeLoginEmailIntentResult,
  LoginEmailVerificationResult,
  PublicInviteIntentResult,
  ResendLoginEmailVerificationResult,
  ResetPasswordResult,
  StaffInviteConsumptionResult,
  StaffInviteIdentity,
  StaffInviteIntentResult,
  StudentRegistrationConsumptionResult,
  StudentRegistrationIdentityVerificationInput,
  StudentRegistrationIdentityVerificationResult,
  StudentRegistrationInput,
  StudentRegistrationLinkInfoResult,
  VerificationIntentResult,
} from './types';

export type PublicAuthApiPort = {
  requestPasswordReset: (input: { email: string }) => Promise<void>;
  getChangeLoginEmailIntent: (input: {
    verificationCode: string;
  }) => Promise<ChangeLoginEmailIntentResult>;
  consumeChangeLoginEmail: (input: {
    accessToken?: string | null;
    verificationCode: string;
  }) => Promise<ChangeLoginEmailConfirmResult>;
  verifyResetPasswordIntent: (input: {
    verificationCode: string;
  }) => Promise<VerificationIntentResult>;
  getStaffInviteInfo: (input: { verificationCode: string }) => Promise<StaffInviteIntentResult>;
  getPublicInviteInfo: (input: {
    inviteType: 'staff';
    verificationCode: string;
  }) => Promise<PublicInviteIntentResult>;
  getStudentRegistrationLinkInfo: (input: {
    token: string;
  }) => Promise<StudentRegistrationLinkInfoResult>;
  verifyStudentRegistrationIdentity: (
    input: StudentRegistrationIdentityVerificationInput,
  ) => Promise<StudentRegistrationIdentityVerificationResult>;
  consumeStudentRegistrationLink: (
    input: StudentRegistrationInput,
  ) => Promise<StudentRegistrationConsumptionResult>;
  verifyLoginEmail: (input: { token: string }) => Promise<LoginEmailVerificationResult>;
  resendLoginEmailVerification: (input: {
    loginEmail: string;
  }) => Promise<ResendLoginEmailVerificationResult>;
  loginUpstreamSession: (input: { password: string; userId: string }) => Promise<{
    expiresAt: string;
    upstreamSessionToken: string;
  }>;
  fetchVerifiedStaffIdentity: (input: { sessionToken: string }) => Promise<StaffInviteIdentity>;
  consumeStaffInvite: (input: {
    verificationCode: string;
    upstreamSessionToken: string;
    loginPassword: string;
    loginName?: string;
    nickname?: string;
    staffName: string;
    staffDepartmentId: string | null;
  }) => Promise<StaffInviteConsumptionResult>;
  resetPassword: (input: {
    newPassword: string;
    verificationCode: string;
  }) => Promise<ResetPasswordResult>;
};

export type PublicAuthPorts = {
  api: PublicAuthApiPort;
};
