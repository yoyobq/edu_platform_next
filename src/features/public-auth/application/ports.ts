import type { ResetPasswordResult, VerificationIntentResult } from './types';

export type PublicAuthApiPort = {
  requestPasswordReset: (input: { email: string }) => Promise<void>;
  verifyResetPasswordIntent: (input: {
    verificationCode: string;
  }) => Promise<VerificationIntentResult>;
  resetPassword: (input: {
    newPassword: string;
    verificationCode: string;
  }) => Promise<ResetPasswordResult>;
};

export type PublicAuthPorts = {
  api: PublicAuthApiPort;
};
