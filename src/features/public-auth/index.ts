import type { PublicAuthPorts } from './application/ports';
import { requestPasswordReset as runRequestPasswordReset } from './application/request-password-reset';
import { resetPassword as runResetPassword } from './application/reset-password';
import { verifyResetPasswordIntent as runVerifyResetPasswordIntent } from './application/verify-reset-password-intent';
import { publicAuthApi } from './infrastructure/public-auth-api';

export type { PublicAuthApiPort, PublicAuthPorts } from './application/ports';
export type {
  ChangeLoginEmailConfirmResult,
  ChangeLoginEmailIntentResult,
  LoginEmailVerificationReason,
  LoginEmailVerificationResult,
  PasswordResetIntentKind,
  PasswordResetPreview,
  PublicInviteInfo,
  PublicInviteIntentResult,
  ResendLoginEmailVerificationResult,
  ResetPasswordResult,
  StaffInviteConsumptionResult,
  StaffInviteIdentity,
  StaffInviteIdentityResult,
  StaffInviteInfo,
  StaffInviteIntentResult,
  StudentRegistrationConsumptionResult,
  StudentRegistrationIdentityVerificationInput,
  StudentRegistrationIdentityVerificationReason,
  StudentRegistrationIdentityVerificationResult,
  StudentRegistrationInput,
  StudentRegistrationLinkInfo,
  StudentRegistrationLinkInfoResult,
  StudentRegistrationLinkReason,
  VerificationFailureReason,
  VerificationIntentResult,
} from './application/types';
export { ForgotPasswordForm } from './ui/forgot-password-form';
export { LoginEmailVerificationIntentPanel } from './ui/login-email-verification-intent-panel';
export { ResetPasswordForm } from './ui/reset-password-form';
export type { ResetPasswordIntentPanelCopy } from './ui/reset-password-intent-panel';
export { ResetPasswordIntentPanel } from './ui/reset-password-intent-panel';
export { StaffInviteIntentPanel } from './ui/staff-invite-intent-panel';
export type { StudentRegistrationPanelContext } from './ui/student-registration-link-panel';
export { StudentRegistrationLinkPanel } from './ui/student-registration-link-panel';
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

export function loginUpstreamSession(input: { password: string; userId: string }) {
  return publicAuthApi.loginUpstreamSession(input);
}
