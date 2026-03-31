import type { PublicAuthPorts } from './ports';
import type { VerificationFailureReason } from './types';

export type ResetPasswordIntentWorkflowState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'success' }
  | { reason: VerificationFailureReason; status: 'failure' };

export type ResetPasswordIntentSubmitResult =
  | { status: 'success' }
  | { reason: VerificationFailureReason; status: 'failure' }
  | { message: string; status: 'error' };

export async function loadResetPasswordIntent(
  ports: PublicAuthPorts,
  input: { verificationCode: string },
): Promise<ResetPasswordIntentWorkflowState> {
  if (!input.verificationCode.trim()) {
    return {
      status: 'failure',
      reason: 'invalid',
    };
  }

  try {
    const result = await ports.api.verifyResetPasswordIntent(input);

    if (result.status === 'valid') {
      return { status: 'ready' };
    }

    return {
      status: 'failure',
      reason: result.reason,
    };
  } catch {
    return {
      status: 'failure',
      reason: 'unknown',
    };
  }
}

export async function submitResetPasswordIntent(
  ports: PublicAuthPorts,
  input: { newPassword: string; verificationCode: string },
): Promise<ResetPasswordIntentSubmitResult> {
  const result = await ports.api.resetPassword(input);

  if (result.status === 'success') {
    return { status: 'success' };
  }

  if (result.status === 'failure') {
    return {
      status: 'failure',
      reason: result.reason,
    };
  }

  return {
    status: 'error',
    message: result.message,
  };
}
