import type { OperationVariables } from '@apollo/client';

import {
  requestUpstreamLoginSession,
  resolveStaffInviteUpstreamErrorMessage,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { normalizeDepartmentName } from '@/shared/department';
import { executeGraphQL, type GraphQLAuthMode, isGraphQLIngressError } from '@/shared/graphql';

import type { PublicAuthApiPort } from '../application/ports';
import type {
  ChangeLoginEmailConfirmResult,
  ChangeLoginEmailIntentResult,
  ResetPasswordResult,
  StaffInviteIdentity,
  StaffInviteIntentResult,
  VerificationFailureReason,
  VerificationIntentResult,
} from '../application/types';

import { mapVerificationRecordToIntentResult } from './mapper';
import {
  mapVerificationFailureReason,
  resolveVerificationFailureReason,
} from './resolve-verification-failure-reason';

type RequestPasswordResetEmailResponse = {
  requestPasswordResetEmail: {
    message?: string | null;
    success: boolean;
  };
};

type VerificationRecordFailureReason = 'EXPIRED' | 'INVALID' | 'USED';

type FindVerificationRecordResponse = {
  findVerificationRecord: {
    message?: string | null;
    reason?: VerificationRecordFailureReason | null;
    record?: {
      publicPayload?: unknown;
      notBefore?: string | null;
      status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
    } | null;
    success: boolean;
  };
};

type ResetPasswordResponse = {
  resetPassword: {
    message?: string | null;
    reason?: VerificationRecordFailureReason | null;
    success: boolean;
  };
};

type ConsumeChangeLoginEmailResponse = {
  consumeChangeLoginEmail: {
    accountId?: number | null;
    loginEmail?: string | null;
    message?: string | null;
    oldLoginEmail?: string | null;
    reason?: VerificationRecordFailureReason | null;
    success: boolean;
  };
};

type PublicInviteInfoResponse = {
  publicInviteInfo: {
    info?: {
      canProceed: boolean;
      description?: string | null;
      expiresAt: string;
      invitedEmail: string;
      issuer?: string | null;
      statusReason: 'AVAILABLE' | 'CONSUMED' | 'EXPIRED' | 'INVALID';
      title?: string | null;
      type: 'INVITE_STAFF' | 'INVITE_STUDENT' | 'PASSWORD_RESET' | 'MAGIC_LINK';
    } | null;
    message?: string | null;
    reason?: VerificationRecordFailureReason | null;
    success: boolean;
  };
};

type FetchVerifiedStaffIdentityResponse = {
  fetchVerifiedStaffIdentity: {
    departmentName?: string | null;
    expiresAt: string;
    identityKind: string;
    orgId?: string | null;
    personId: string;
    personName: string;
    upstreamLoginId: string;
    upstreamSessionToken: string;
  };
};

type ConsumeStaffInviteResponse = {
  consumeVerificationFlowPublic: {
    accountId?: number | null;
    message: string;
    success: boolean;
  };
};

const REQUEST_PASSWORD_RESET_EMAIL_MUTATION = `
  mutation RequestPasswordResetEmail($input: RequestPasswordResetEmailInput!) {
    requestPasswordResetEmail(input: $input) {
      message
      success
    }
  }
`;

const FIND_PASSWORD_RESET_RECORD_QUERY = `
  query FindPasswordResetVerificationRecord($input: FindVerificationRecordInput!) {
    findVerificationRecord(input: $input) {
      message
      reason
      success
      record {
        notBefore
        status
      }
    }
  }
`;

const FIND_CHANGE_LOGIN_EMAIL_RECORD_QUERY = `
  query FindChangeLoginEmailVerificationRecord($input: FindVerificationRecordInput!) {
    findVerificationRecord(input: $input) {
      message
      reason
      success
      record {
        notBefore
        publicPayload
        status
      }
    }
  }
`;

const RESET_PASSWORD_MUTATION = `
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      message
      reason
      success
    }
  }
`;

const CONSUME_CHANGE_LOGIN_EMAIL_MUTATION = `
  mutation ConsumeChangeLoginEmail($input: ConsumeChangeLoginEmailInput!) {
    consumeChangeLoginEmail(input: $input) {
      accountId
      loginEmail
      message
      oldLoginEmail
      reason
      success
    }
  }
`;

const PUBLIC_INVITE_INFO_QUERY = `
  query PublicInviteInfo($token: String!) {
    publicInviteInfo(token: $token) {
      success
      reason
      message
      info {
        canProceed
        description
        expiresAt
        invitedEmail
        issuer
        statusReason
        title
        type
      }
    }
  }
`;

const FETCH_VERIFIED_STAFF_IDENTITY_QUERY = `
  query FetchVerifiedStaffIdentity($sessionToken: String!) {
    fetchVerifiedStaffIdentity(sessionToken: $sessionToken) {
      departmentName
      expiresAt
      identityKind
      orgId
      personId
      personName
      upstreamLoginId
      upstreamSessionToken
    }
  }
`;

const CONSUME_STAFF_INVITE_MUTATION = `
  mutation ConsumeStaffInvite($input: ConsumeVerificationFlowPublicInput!) {
    consumeVerificationFlowPublic(input: $input) {
      accountId
      message
      success
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options?: {
    accessToken?: string;
    allowAuthRetry?: boolean;
    authMode?: GraphQLAuthMode;
  },
): Promise<TData> {
  return executeGraphQL(query, variables, {
    accessToken: options?.accessToken,
    allowAuthRetry: options?.allowAuthRetry,
    authMode: options?.authMode ?? 'none',
  });
}

async function requestPasswordResetEmail(email: string) {
  const response = await requestGraphQL<
    RequestPasswordResetEmailResponse,
    {
      input: {
        email: string;
      };
    }
  >(REQUEST_PASSWORD_RESET_EMAIL_MUTATION, {
    input: {
      email,
    },
  });

  if (!response.requestPasswordResetEmail.success) {
    throw new Error(response.requestPasswordResetEmail.message || '暂时无法发送重置邮件。');
  }
}

async function findResetPasswordIntent(
  verificationCode: string,
): Promise<VerificationIntentResult> {
  const response = await requestGraphQL<
    FindVerificationRecordResponse,
    {
      input: {
        expectedType: 'PASSWORD_RESET';
        ignoreTargetRestriction: boolean;
        token: string;
      };
    }
  >(FIND_PASSWORD_RESET_RECORD_QUERY, {
    input: {
      expectedType: 'PASSWORD_RESET',
      ignoreTargetRestriction: true,
      token: verificationCode,
    },
  });

  const result = response.findVerificationRecord;

  if (result.success && result.record) {
    return mapVerificationRecordToIntentResult(result.record);
  }

  const reason = mapVerificationFailureReason(result.reason);

  if (reason === 'expired') {
    return {
      status: 'expired',
      reason,
    };
  }

  if (reason === 'used') {
    return {
      status: 'used',
      reason,
    };
  }

  if (reason === 'invalid') {
    return {
      status: 'invalid',
      reason,
    };
  }

  throw new Error(result.message || '暂时无法确认重置链接状态。');
}

function normalizeOptionalStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractChangeLoginEmailPreview(publicPayload: unknown): {
  loginEmail: string | null;
  oldLoginEmail: string | null;
} {
  const payload = toRecord(publicPayload);

  if (!payload) {
    return {
      loginEmail: null,
      oldLoginEmail: null,
    };
  }

  const preview = toRecord(payload.preview);

  return {
    loginEmail:
      normalizeOptionalStringValue(preview?.toMasked) ||
      normalizeOptionalStringValue(payload.loginEmail) ||
      normalizeOptionalStringValue(payload.newLoginEmail) ||
      normalizeOptionalStringValue(payload.toLoginEmail) ||
      null,
    oldLoginEmail:
      normalizeOptionalStringValue(preview?.fromMasked) ||
      normalizeOptionalStringValue(payload.oldLoginEmail) ||
      normalizeOptionalStringValue(payload.fromLoginEmail) ||
      null,
  };
}

async function findChangeLoginEmailIntent(
  verificationCode: string,
): Promise<ChangeLoginEmailIntentResult> {
  const response = await requestGraphQL<
    FindVerificationRecordResponse,
    {
      input: {
        expectedType: 'EMAIL_VERIFY_LINK';
        ignoreTargetRestriction: boolean;
        token: string;
      };
    }
  >(FIND_CHANGE_LOGIN_EMAIL_RECORD_QUERY, {
    input: {
      expectedType: 'EMAIL_VERIFY_LINK',
      ignoreTargetRestriction: true,
      token: verificationCode,
    },
  });

  const result = response.findVerificationRecord;

  if (result.success && result.record) {
    const intent = mapVerificationRecordToIntentResult(result.record);

    if (intent.status === 'valid') {
      return {
        status: 'ready',
        ...extractChangeLoginEmailPreview(result.record.publicPayload),
      };
    }

    if (intent.reason === 'unknown') {
      return {
        status: 'error',
        message: result.message || '暂时无法确认登录邮箱变更链接状态。',
      };
    }

    return {
      status: 'failure',
      reason: intent.reason,
    };
  }

  const reason = mapVerificationFailureReason(result.reason);

  if (reason !== 'unknown') {
    return {
      status: 'failure',
      reason,
    };
  }

  return {
    status: 'error',
    message: result.message || '暂时无法确认登录邮箱变更链接状态。',
  };
}

function mapInviteStatusReasonToFailureReason(
  statusReason?: string | null,
  reason?: string | null,
): VerificationFailureReason {
  const mappedStatusReason = mapVerificationFailureReason(statusReason);

  if (mappedStatusReason !== 'unknown') {
    return mappedStatusReason;
  }

  return mapVerificationFailureReason(reason);
}

function resolveInviteIntentFailureMessage(
  reason: VerificationFailureReason,
  fallback?: string | null,
): string {
  if (fallback) {
    return fallback;
  }

  if (reason === 'expired') {
    return '这个邀请链接已经过期，请联系管理员重新发起邀请。';
  }

  if (reason === 'used') {
    return '这个邀请链接已经被使用，无法继续完成教职工邀请注册。';
  }

  if (reason === 'invalid') {
    return '这个邀请链接无效，请确认链接是否完整。';
  }

  return '暂时无法确认邀请链接状态，请稍后重试。';
}

function resolvePublicAuthErrorMessage(error: unknown, fallback: string): string {
  return resolveUpstreamErrorMessage(error, fallback);
}

function resolveChangeLoginEmailFailureMessage(
  reason: Exclude<VerificationFailureReason, 'unknown'>,
  fallback?: string | null,
): string {
  if (fallback) {
    return fallback;
  }

  if (reason === 'expired') {
    return '这个邮箱验证链接已经过期，请重新发起登录邮箱变更。';
  }

  if (reason === 'used') {
    return '这个邮箱验证链接已经被使用，当前无需再次验证。';
  }

  return '这个邮箱验证链接无效，请确认链接是否完整。';
}

async function findStaffInviteIntent(verificationCode: string): Promise<StaffInviteIntentResult> {
  try {
    const response = await requestGraphQL<
      PublicInviteInfoResponse,
      {
        token: string;
      }
    >(PUBLIC_INVITE_INFO_QUERY, {
      token: verificationCode,
    });
    const result = response.publicInviteInfo;
    const info = result.info;

    if (info?.type && info.type !== 'INVITE_STAFF') {
      return {
        status: 'failure',
        reason: 'invalid',
        message: '当前只支持教职工邀请链接。',
      };
    }

    if (
      result.success &&
      info &&
      info.type === 'INVITE_STAFF' &&
      info.canProceed &&
      info.statusReason === 'AVAILABLE'
    ) {
      return {
        status: 'ready',
        invite: {
          description: info.description || null,
          expiresAt: info.expiresAt,
          invitedEmail: info.invitedEmail,
          issuer: info.issuer || null,
          title: info.title || null,
        },
      };
    }

    const reason = mapInviteStatusReasonToFailureReason(info?.statusReason, result.reason);

    return {
      status: 'failure',
      reason,
      message: resolveInviteIntentFailureMessage(reason, result.message),
    };
  } catch (error) {
    return {
      status: 'error',
      message: resolvePublicAuthErrorMessage(error, '暂时无法读取邀请信息。'),
    };
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

async function loginUpstreamSession(input: { password: string; userId: string }): Promise<{
  expiresAt: string;
  upstreamSessionToken: string;
}> {
  try {
    return await requestUpstreamLoginSession(input);
  } catch (error) {
    throw new Error(
      resolveStaffInviteUpstreamErrorMessage(error, '上游身份核对失败，请稍后重试。'),
    );
  }
}

async function fetchVerifiedStaffIdentity(input: {
  sessionToken: string;
}): Promise<StaffInviteIdentity> {
  try {
    const response = await requestGraphQL<
      FetchVerifiedStaffIdentityResponse,
      {
        sessionToken: string;
      }
    >(FETCH_VERIFIED_STAFF_IDENTITY_QUERY, {
      sessionToken: input.sessionToken,
    });
    const identity = response.fetchVerifiedStaffIdentity;

    if (!identity.identityKind.toUpperCase().includes('STAFF')) {
      throw new Error('当前账号未通过教职工身份核对。');
    }

    return {
      departmentName: normalizeDepartmentName(identity.departmentName),
      expiresAt: identity.expiresAt,
      orgId: identity.orgId || null,
      personId: identity.personId,
      personName: identity.personName,
      upstreamLoginId: identity.upstreamLoginId,
      upstreamSessionToken: identity.upstreamSessionToken,
    };
  } catch (error) {
    if (error instanceof Error && error.message === '当前账号未通过教职工身份核对。') {
      throw error;
    }

    throw new Error(
      resolveStaffInviteUpstreamErrorMessage(error, '暂时无法确认教职工身份，请稍后重试。'),
    );
  }
}

export const publicAuthApi: PublicAuthApiPort = {
  async requestPasswordReset(input) {
    await requestPasswordResetEmail(input.email);
  },
  async getChangeLoginEmailIntent(input): Promise<ChangeLoginEmailIntentResult> {
    try {
      return await findChangeLoginEmailIntent(input.verificationCode);
    } catch (error) {
      return {
        status: 'error',
        message: resolvePublicAuthErrorMessage(error, '暂时无法确认登录邮箱变更链接状态。'),
      };
    }
  },
  async consumeChangeLoginEmail(input): Promise<ChangeLoginEmailConfirmResult> {
    try {
      const accessToken = input.accessToken?.trim() || undefined;
      const response = await requestGraphQL<
        ConsumeChangeLoginEmailResponse,
        {
          input: {
            token: string;
          };
        }
      >(
        CONSUME_CHANGE_LOGIN_EMAIL_MUTATION,
        {
          input: {
            token: input.verificationCode,
          },
        },
        accessToken
          ? {
              accessToken,
              authMode: 'required',
            }
          : {
              authMode: 'none',
            },
      );
      const result = response.consumeChangeLoginEmail;

      if (result.success) {
        return {
          accountId: result.accountId ?? null,
          loginEmail: result.loginEmail ?? null,
          message: result.message ?? null,
          oldLoginEmail: result.oldLoginEmail ?? null,
          status: 'success',
        };
      }

      const reason = mapVerificationFailureReason(result.reason);

      if (reason !== 'unknown') {
        return {
          message: resolveChangeLoginEmailFailureMessage(reason, result.message),
          reason,
          status: 'failure',
        };
      }

      return {
        message: result.message || '暂时无法完成邮箱验证。',
        status: 'error',
      };
    } catch (error) {
      const reason = resolveVerificationFailureReason(error);

      if (reason !== 'unknown') {
        return {
          message: resolveChangeLoginEmailFailureMessage(reason),
          reason,
          status: 'failure',
        };
      }

      return {
        message: resolvePublicAuthErrorMessage(error, '暂时无法完成邮箱验证。'),
        status: 'error',
      };
    }
  },
  async getStaffInviteInfo(input) {
    return findStaffInviteIntent(input.verificationCode);
  },
  async loginUpstreamSession(input) {
    return loginUpstreamSession(input);
  },
  async fetchVerifiedStaffIdentity(input) {
    return fetchVerifiedStaffIdentity(input);
  },
  async consumeStaffInvite(input) {
    try {
      const response = await requestGraphQL<
        ConsumeStaffInviteResponse,
        {
          input: {
            expectedType: 'INVITE_STAFF';
            loginName?: string;
            loginPassword: string;
            nickname?: string;
            staffDepartmentId: string | null;
            staffName: string;
            token: string;
            upstreamSessionToken: string;
          };
        }
      >(CONSUME_STAFF_INVITE_MUTATION, {
        input: {
          expectedType: 'INVITE_STAFF',
          loginName: normalizeOptionalText(input.loginName),
          loginPassword: input.loginPassword,
          nickname: normalizeOptionalText(input.nickname),
          staffDepartmentId: input.staffDepartmentId,
          staffName: input.staffName,
          token: input.verificationCode,
          upstreamSessionToken: input.upstreamSessionToken,
        },
      });
      const result = response.consumeVerificationFlowPublic;

      if (result.success) {
        return {
          status: 'success',
          accountId: result.accountId ?? null,
        };
      }

      return {
        status: 'failure',
        message: result.message || '暂时无法完成邀请注册。',
      };
    } catch (error) {
      return {
        status: 'error',
        message: resolveStaffInviteUpstreamErrorMessage(error, '暂时无法完成邀请注册。'),
      };
    }
  },
  async resetPassword(input) {
    try {
      const response = await requestGraphQL<
        ResetPasswordResponse,
        {
          input: {
            newPassword: string;
            token: string;
          };
        }
      >(RESET_PASSWORD_MUTATION, {
        input: {
          newPassword: input.newPassword,
          token: input.verificationCode,
        },
      });

      if (response.resetPassword.success) {
        return { status: 'success' };
      }

      const reason = mapVerificationFailureReason(response.resetPassword.reason);

      if (reason !== 'unknown') {
        return {
          status: 'failure',
          reason,
        };
      }

      return {
        status: 'error',
        message: response.resetPassword.message || '暂时无法完成密码重置。',
      };
    } catch (error) {
      return toResetPasswordResult(error);
    }
  },
  async verifyResetPasswordIntent(input) {
    return findResetPasswordIntent(input.verificationCode);
  },
};

function toResetPasswordResult(error: unknown): ResetPasswordResult {
  if (isGraphQLIngressError(error)) {
    return {
      status: 'error',
      message: error.userMessage,
    };
  }

  const reason = resolveVerificationFailureReason(error);

  if (reason !== 'unknown') {
    return {
      status: 'failure',
      reason,
    };
  }

  return {
    status: 'error',
    message: error instanceof Error ? error.message : '暂时无法完成密码重置。',
  };
}
