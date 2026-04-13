import type { PublicAuthPorts } from './application/ports';
import { requestPasswordReset as runRequestPasswordReset } from './application/request-password-reset';
import { resetPassword as runResetPassword } from './application/reset-password';
import { verifyResetPasswordIntent as runVerifyResetPasswordIntent } from './application/verify-reset-password-intent';
import { publicAuthApi } from './infrastructure/public-auth-api';

export type { PublicAuthApiPort, PublicAuthPorts } from './application/ports';
export type {
  ChangeLoginEmailResult,
  ResetPasswordResult,
  StaffInviteConsumptionResult,
  StaffInviteIdentity,
  StaffInviteIdentityResult,
  StaffInviteInfo,
  StaffInviteIntentResult,
  VerificationFailureReason,
  VerificationIntentResult,
} from './application/types';
export { ForgotPasswordForm } from './ui/forgot-password-form';
export { ResetPasswordForm } from './ui/reset-password-form';
export { ResetPasswordIntentPanel } from './ui/reset-password-intent-panel';
export { StaffInviteIntentPanel } from './ui/staff-invite-intent-panel';
export { VerifyEmailIntentPanel } from './ui/verify-email-intent-panel';

const publicAuthPorts: PublicAuthPorts = {
  api: publicAuthApi,
};

export function requestPasswordReset(input: { email: string }) {
  return runRequestPasswordReset(publicAuthPorts, input);
}

export function verifyResetPasswordIntent(input: { verificationCode: string }) {
  return runVerifyResetPasswordIntent(publicAuthPorts, input);
}

export function resetPassword(input: { newPassword: string; verificationCode: string }) {
  return runResetPassword(publicAuthPorts, input);
}
