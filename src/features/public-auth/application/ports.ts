import type {
  ResetPasswordResult,
  StaffInviteConsumptionResult,
  StaffInviteIdentity,
  StaffInviteIntentResult,
  VerificationIntentResult,
} from './types';

export type PublicAuthApiPort = {
  requestPasswordReset: (input: { email: string }) => Promise<void>;
  verifyResetPasswordIntent: (input: {
    verificationCode: string;
  }) => Promise<VerificationIntentResult>;
  getStaffInviteInfo: (input: { verificationCode: string }) => Promise<StaffInviteIntentResult>;
  loginUpstreamSession: (input: { password: string; userId: string }) => Promise<{
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
