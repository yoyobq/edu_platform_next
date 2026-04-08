import type { PublicAuthPorts } from './ports';
import type {
  StaffInviteConsumptionResult,
  StaffInviteIdentityResult,
  StaffInviteIntentResult,
} from './types';

export async function loadStaffInviteIntent(
  ports: PublicAuthPorts,
  input: { verificationCode: string },
): Promise<StaffInviteIntentResult> {
  if (!input.verificationCode.trim()) {
    return {
      status: 'failure',
      reason: 'invalid',
      message: '这个邀请链接无效，请确认链接是否完整。',
    };
  }

  return ports.api.getStaffInviteInfo(input);
}

export async function verifyStaffInviteIdentity(
  ports: PublicAuthPorts,
  input: { password: string; userId: string },
): Promise<StaffInviteIdentityResult> {
  try {
    const session = await ports.api.loginUpstreamSession(input);
    const identity = await ports.api.fetchVerifiedStaffIdentity({
      sessionToken: session.upstreamSessionToken,
    });

    return {
      status: 'success',
      identity,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '上游身份核对失败，请稍后重试。',
    };
  }
}

export async function submitStaffInvite(
  ports: PublicAuthPorts,
  input: {
    verificationCode: string;
    upstreamSessionToken: string;
    loginPassword: string;
    loginName?: string;
    nickname?: string;
    staffName: string;
    staffDepartmentId: string | null;
  },
): Promise<StaffInviteConsumptionResult> {
  return ports.api.consumeStaffInvite(input);
}
