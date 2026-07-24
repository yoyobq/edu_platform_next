import type { OperationVariables } from '@apollo/client';

import { normalizeDepartmentName } from '@/entities/department';
import {
  executeUpstreamSessionGraphQL,
  requestUpstreamLoginSession,
  resolveStaffInviteUpstreamErrorMessage,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { normalizeOptionalTextValue } from '@/shared/form-normalization';
import {
  executeGraphQL,
  type GraphQLAuthMode,
  hasGraphQLDetailCode,
  isGraphQLIngressError,
} from '@/shared/graphql';

import type { PublicAuthApiPort } from '../application/ports';
import type {
  ChangeLoginEmailConfirmResult,
  ChangeLoginEmailIntentResult,
  LoginEmailVerificationReason,
  LoginEmailVerificationResult,
  PasswordResetPreview,
  PublicInviteInfo,
  PublicInviteIntentResult,
  PublicInviteType,
  ResendLoginEmailVerificationResult,
  ResetPasswordResult,
  StaffInviteIdentity,
  StaffInviteIntentResult,
  StaffInviteStatusReason,
  StudentRegistrationAccountVerificationReason,
  StudentRegistrationAccountVerificationResult,
  StudentRegistrationConsumptionResult,
  StudentRegistrationIdentityVerificationReason,
  StudentRegistrationIdentityVerificationResult,
  StudentRegistrationLinkInfo,
  StudentRegistrationLinkInfoResult,
  StudentRegistrationLinkReason,
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
      inviteUrl?: string | null;
      invitedEmail: string;
      issuer?: string | null;
      staffId?: string | null;
      statusReason: 'AVAILABLE' | 'CONSUMED' | 'EXPIRED' | 'INVALID';
      title?: string | null;
      type: 'INVITE_STAFF' | 'PASSWORD_RESET' | 'MAGIC_LINK';
    } | null;
    message?: string | null;
    reason?: VerificationRecordFailureReason | null;
    success: boolean;
  };
};

type PublicStudentRegistrationLinkInfoResponse = {
  publicStudentRegistrationLinkInfo: {
    info?: {
      canProceed: boolean;
      classCode: string;
      className?: string | null;
      expiresAt: string;
      scope: 'CLASS' | 'STUDENT';
      status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
      studentId?: string | null;
    } | null;
    message?: string | null;
    reason?: StudentRegistrationLinkReason | null;
    success: boolean;
  };
};

type ConsumeStudentRegistrationLinkResponse = {
  consumeStudentRegistrationLink: {
    accountId?: number | null;
    accountStatus?: string | null;
    emailVerificationRequired?: boolean | null;
    emailVerificationSent?: boolean | null;
    loginEmail?: string | null;
    message?: string | null;
    success: boolean;
  };
};

type VerifyStudentRegistrationIdentityResponse = {
  verifyStudentRegistrationIdentity: {
    canProceed?: boolean | null;
    message?: string | null;
    reason?: StudentRegistrationIdentityVerificationReason | null;
    success: boolean;
  };
};

type VerifyStudentRegistrationAccountResponse = {
  verifyStudentRegistrationAccount: {
    canProceed?: boolean | null;
    message?: string | null;
    reason?: StudentRegistrationAccountVerificationReason | null;
    success: boolean;
  };
};

type VerifyLoginEmailResponse = {
  verifyLoginEmail: {
    accountId?: number | null;
    loginEmail?: string | null;
    message?: string | null;
    reason?: LoginEmailVerificationReason | null;
    success: boolean;
  };
};

type ResendLoginEmailVerificationResponse = {
  resendLoginEmailVerification: {
    message?: string | null;
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
        publicPayload
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
        inviteUrl
        invitedEmail
        issuer
        staffId
        statusReason
        title
        type
      }
    }
  }
`;

const PUBLIC_STUDENT_REGISTRATION_LINK_INFO_QUERY = `
  query PublicStudentRegistrationLinkInfo($token: String!) {
    publicStudentRegistrationLinkInfo(token: $token) {
      success
      reason
      message
      info {
        canProceed
        status
        scope
        classCode
        className
        studentId
        expiresAt
      }
    }
  }
`;

const CONSUME_STUDENT_REGISTRATION_LINK_MUTATION = `
  mutation ConsumeStudentRegistrationLink($input: ConsumeStudentRegistrationLinkInput!) {
    consumeStudentRegistrationLink(input: $input) {
      success
      message
      accountId
      loginEmail
      accountStatus
      emailVerificationRequired
      emailVerificationSent
    }
  }
`;

const VERIFY_STUDENT_REGISTRATION_IDENTITY_MUTATION = `
  mutation VerifyStudentRegistrationIdentity($input: VerifyStudentRegistrationIdentityInput!) {
    verifyStudentRegistrationIdentity(input: $input) {
      success
      canProceed
      reason
      message
    }
  }
`;

const VERIFY_STUDENT_REGISTRATION_ACCOUNT_MUTATION = `
  mutation VerifyStudentRegistrationAccount($input: VerifyStudentRegistrationAccountInput!) {
    verifyStudentRegistrationAccount(input: $input) {
      success
      canProceed
      reason
      message
    }
  }
`;

const VERIFY_LOGIN_EMAIL_MUTATION = `
  mutation VerifyLoginEmail($input: VerifyLoginEmailInput!) {
    verifyLoginEmail(input: $input) {
      success
      message
      reason
      accountId
      loginEmail
    }
  }
`;

const RESEND_LOGIN_EMAIL_VERIFICATION_MUTATION = `
  mutation ResendLoginEmailVerification($input: ResendLoginEmailVerificationInput!) {
    resendLoginEmailVerification(input: $input) {
      success
      message
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
    const intentResult = mapVerificationRecordToIntentResult(result.record);

    if (intentResult.status === 'valid') {
      return {
        ...intentResult,
        passwordResetPreview: extractPasswordResetPreview(result.record.publicPayload),
      };
    }

    return intentResult;
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

function extractPasswordResetPreview(publicPayload: unknown): PasswordResetPreview | undefined {
  const payload = toRecord(publicPayload);
  const preview = toRecord(payload?.preview);

  if (!preview) {
    return undefined;
  }

  const kind = preview.kind;

  if (kind !== 'legacy-user-password-reset' && kind !== 'password-reset') {
    return undefined;
  }

  return {
    kind,
    loginEmailMasked: normalizeOptionalStringValue(preview.loginEmailMasked),
    nickname: normalizeOptionalStringValue(preview.nickname),
  };
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
  // Invite expiry was shortened to 48 hours; keep this copy consistent even if older backends send stale text.
  if (reason === 'expired') {
    return '这个邀请链接已经过期。邀请链接签发后 48 小时内有效，请联系管理员重新发送邀请。';
  }

  if (fallback) {
    return fallback;
  }

  if (reason === 'used') {
    return '这个邀请链接已经使用过了，不能再次用于邀请注册。如需帮助，请联系管理员。';
  }

  if (reason === 'invalid') {
    return '这个邀请链接暂时无法识别，请确认邮件中的链接是否完整。';
  }

  return '暂时无法确认邀请链接状态，请稍后再试。';
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

function resolveStudentRegistrationLinkFailureMessage(
  reason: StudentRegistrationLinkReason,
  fallback?: string | null,
): string {
  if (fallback) {
    return fallback;
  }

  if (reason === 'LINK_EXPIRED') {
    return '这个学生注册链接已经过期，请联系班主任或管理员重新获取链接。';
  }

  if (reason === 'LINK_REVOKED') {
    return '这个学生注册链接已经撤销，请联系班主任或管理员确认最新链接。';
  }

  if (reason === 'LINK_NOT_ACTIVE') {
    return '这个学生注册链接暂时不可用，请联系班主任或管理员确认链接状态。';
  }

  if (reason === 'CLASS_NOT_FOUND') {
    return '这个学生注册链接对应的班级不存在，请联系班主任或管理员处理。';
  }

  if (reason === 'LINK_NOT_FOUND') {
    return '这个学生注册链接无效，请确认链接是否完整。';
  }

  return '这个学生注册链接暂时不可用，请稍后再试。';
}

function resolveStudentRegistrationIdentityVerificationFailureMessage(
  reason: StudentRegistrationIdentityVerificationReason,
  fallback?: string | null,
): string {
  if (reason === 'IDENTITY_MISMATCH') {
    return '身份信息不匹配，请核对后重试。';
  }

  if (reason === 'AVAILABLE') {
    return fallback || '暂时无法确认身份信息，请稍后再试。';
  }

  return resolveStudentRegistrationLinkFailureMessage(reason, fallback);
}

function resolveStudentRegistrationAccountVerificationFailureMessage(
  reason: StudentRegistrationAccountVerificationReason,
  fallback?: string | null,
): string {
  if (reason === 'LOGIN_NAME_TAKEN') {
    return '这个登录名已被使用，请换一个。';
  }

  if (fallback) {
    return fallback;
  }

  if (reason === 'LOGIN_NAME_INVALID') {
    return '登录名格式不正确，请修改后重试。';
  }

  if (reason === 'PASSWORD_INVALID') {
    return '登录密码不符合要求，请修改后重试。';
  }

  if (reason === 'NICKNAME_INVALID') {
    return '昵称不符合要求，请修改后重试。';
  }

  if (reason === 'AVAILABLE') {
    return '暂时无法校验账号信息，请稍后再试。';
  }

  return resolveStudentRegistrationLinkFailureMessage(reason);
}

const STUDENT_REGISTRATION_LINK_ERROR_CODE_REASON_MAP: {
  codes: readonly string[];
  reason: StudentRegistrationLinkReason;
}[] = [
  {
    reason: 'LINK_NOT_FOUND',
    codes: ['STUDENT_REGISTRATION_LINK_NOT_FOUND', 'LINK_NOT_FOUND'],
  },
  {
    reason: 'LINK_EXPIRED',
    codes: ['STUDENT_REGISTRATION_LINK_EXPIRED', 'LINK_EXPIRED'],
  },
  {
    reason: 'LINK_REVOKED',
    codes: ['STUDENT_REGISTRATION_LINK_REVOKED', 'LINK_REVOKED'],
  },
  {
    reason: 'LINK_NOT_ACTIVE',
    codes: [
      'STUDENT_REGISTRATION_LINK_NOT_ACTIVE',
      'STUDENT_REGISTRATION_LINK_ALREADY_CONSUMED',
      'STUDENT_REGISTRATION_LINK_CONSUMED',
      'LINK_NOT_ACTIVE',
    ],
  },
  {
    reason: 'CLASS_NOT_FOUND',
    codes: [
      'STUDENT_REGISTRATION_CLASS_NOT_FOUND',
      'STUDENT_REGISTRATION_LINK_CLASS_NOT_FOUND',
      'CLASS_NOT_FOUND',
    ],
  },
];

function resolveStudentRegistrationLinkFailureReasonFromError(
  error: unknown,
): StudentRegistrationLinkReason | null {
  const matched = STUDENT_REGISTRATION_LINK_ERROR_CODE_REASON_MAP.find(({ codes }) =>
    codes.some((code) => hasGraphQLDetailCode(error, code)),
  );

  return matched?.reason ?? null;
}

function resolveLoginEmailVerificationFailureMessage(
  reason: LoginEmailVerificationReason,
  fallback?: string | null,
): string {
  if (fallback) {
    return fallback;
  }

  if (reason === 'EXPIRED') {
    return '这个登录邮箱验证链接已经过期，请重新发送验证邮件。';
  }

  if (reason === 'USED') {
    return '这个登录邮箱验证链接已经使用过，当前无需重复验证。';
  }

  return '这个登录邮箱验证链接无效，请检查邮件中的链接是否完整。';
}

function isStudentRegistrationIdentityMismatchError(error: unknown): boolean {
  return (
    hasGraphQLDetailCode(error, 'STUDENT_REGISTRATION_IDENTITY_MISMATCH') ||
    hasGraphQLDetailCode(error, 'IDENTITY_MISMATCH')
  );
}

async function findStaffInviteIntent(verificationCode: string): Promise<StaffInviteIntentResult> {
  const result = await findPublicInviteIntent({
    inviteType: 'staff',
    verificationCode,
  });

  if (result.status === 'ready') {
    if (result.invite.type === 'INVITE_STAFF') {
      return {
        status: 'ready',
        invite: mapStaffInviteInfo(result.invite),
      };
    }

    return {
      invite: null,
      status: 'failure',
      reason: 'invalid',
      message: '这个链接不是教职工邀请链接，请确认邮件中的链接是否完整。',
    };
  }

  if (result.status === 'failure') {
    return {
      invite: result.invite?.type === 'INVITE_STAFF' ? mapStaffInviteInfo(result.invite) : null,
      status: 'failure',
      reason: result.reason,
      message: result.message,
    };
  }

  return result;
}

async function findPublicInviteIntent(input: {
  inviteType: PublicInviteType;
  verificationCode: string;
}): Promise<PublicInviteIntentResult> {
  try {
    const response = await requestGraphQL<
      PublicInviteInfoResponse,
      {
        token: string;
      }
    >(PUBLIC_INVITE_INFO_QUERY, {
      token: input.verificationCode,
    });
    const result = response.publicInviteInfo;
    const info = result.info;
    const expectedType = 'INVITE_STAFF';

    if (info?.type && info.type !== expectedType) {
      return {
        invite: null,
        status: 'failure',
        reason: 'invalid',
        message: '这个邀请链接类型与当前入口不匹配，请确认邮件中的链接是否完整。',
      };
    }

    if (
      result.success &&
      info &&
      info.type === expectedType &&
      info.canProceed &&
      info.statusReason === 'AVAILABLE'
    ) {
      return {
        status: 'ready',
        invite: mapPublicInviteInfo(info),
      };
    }

    const reason = mapInviteStatusReasonToFailureReason(info?.statusReason, result.reason);

    return {
      invite: info && info.type === expectedType ? mapPublicInviteInfo(info) : null,
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
  return normalizeOptionalTextValue(value, 'to_undefined');
}

function mapStaffInviteInfo(info: PublicInviteInfo): {
  canProceed: boolean;
  description: string | null;
  expiresAt: string;
  inviteUrl: string | null;
  invitedEmail: string;
  issuer: string | null;
  staffId: string;
  statusReason: StaffInviteStatusReason;
  title: string | null;
} {
  return {
    canProceed: info.canProceed,
    description: info.description || null,
    expiresAt: info.expiresAt,
    inviteUrl: info.inviteUrl || null,
    invitedEmail: info.invitedEmail,
    issuer: info.issuer || null,
    staffId: info.staffId || '',
    statusReason: info.statusReason,
    title: info.title || null,
  };
}

function mapPublicInviteInfo(
  info: NonNullable<PublicInviteInfoResponse['publicInviteInfo']['info']>,
): PublicInviteInfo {
  return {
    canProceed: info.canProceed,
    description: info.description || null,
    expiresAt: info.expiresAt,
    inviteUrl: info.inviteUrl || null,
    invitedEmail: info.invitedEmail,
    issuer: info.issuer || null,
    staffId: info.staffId || null,
    statusReason: info.statusReason,
    title: info.title || null,
    type: 'INVITE_STAFF',
  };
}

function mapStudentRegistrationLinkInfo(
  info: NonNullable<
    PublicStudentRegistrationLinkInfoResponse['publicStudentRegistrationLinkInfo']['info']
  >,
): StudentRegistrationLinkInfo {
  return {
    canProceed: info.canProceed,
    classCode: info.classCode,
    className: info.className || null,
    expiresAt: info.expiresAt,
    scope: info.scope,
    status: info.status,
    studentId: info.studentId || null,
  };
}

async function findStudentRegistrationLinkInfo(
  token: string,
): Promise<StudentRegistrationLinkInfoResult> {
  if (!token.trim()) {
    return {
      info: null,
      status: 'failure',
      reason: 'LINK_NOT_FOUND',
      message: resolveStudentRegistrationLinkFailureMessage('LINK_NOT_FOUND'),
    };
  }

  try {
    const response = await requestGraphQL<
      PublicStudentRegistrationLinkInfoResponse,
      {
        token: string;
      }
    >(PUBLIC_STUDENT_REGISTRATION_LINK_INFO_QUERY, {
      token: token.trim(),
    });
    const result = response.publicStudentRegistrationLinkInfo;
    const info = result.info ? mapStudentRegistrationLinkInfo(result.info) : null;

    if (result.success && info?.canProceed) {
      return {
        status: 'ready',
        info,
      };
    }

    const reason = result.reason || 'LINK_NOT_FOUND';

    return {
      info,
      status: 'failure',
      reason,
      message: resolveStudentRegistrationLinkFailureMessage(reason, result.message),
    };
  } catch (error) {
    return {
      status: 'error',
      message: resolvePublicAuthErrorMessage(error, '暂时无法读取学生注册链接。'),
    };
  }
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
  upstreamSessionToken: string;
}): Promise<StaffInviteIdentity> {
  try {
    const response = await executeUpstreamSessionGraphQL<
      FetchVerifiedStaffIdentityResponse,
      {
        sessionToken: string;
      }
    >(
      FETCH_VERIFIED_STAFF_IDENTITY_QUERY,
      {
        sessionToken: input.upstreamSessionToken,
      },
      {
        authMode: 'none',
      },
    );
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
      const accessToken = normalizeOptionalTextValue(input.accessToken, 'to_undefined');
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
  async getPublicInviteInfo(input) {
    if (!input.verificationCode.trim()) {
      return {
        invite: null,
        status: 'failure',
        reason: 'invalid',
        message: '这个邀请链接暂时无法识别，请确认邮件中的链接是否完整。',
      };
    }

    return findPublicInviteIntent(input);
  },
  async getStudentRegistrationLinkInfo(input) {
    return findStudentRegistrationLinkInfo(input.token);
  },
  async verifyStudentRegistrationIdentity(
    input,
  ): Promise<StudentRegistrationIdentityVerificationResult> {
    try {
      const response = await requestGraphQL<
        VerifyStudentRegistrationIdentityResponse,
        {
          input: {
            idCardLastSix: string;
            name: string;
            studentId: string;
            token: string;
          };
        }
      >(VERIFY_STUDENT_REGISTRATION_IDENTITY_MUTATION, {
        input: {
          idCardLastSix: input.idCardLastSix.trim(),
          name: input.name.trim(),
          studentId: input.studentId.trim(),
          token: input.token.trim(),
        },
      });
      const result = response.verifyStudentRegistrationIdentity;

      if (result.success && result.canProceed === true) {
        return {
          canProceed: true,
          message: result.message ?? null,
          status: 'success',
        };
      }

      const reason = result.reason ?? 'IDENTITY_MISMATCH';

      return {
        canProceed: false,
        message: resolveStudentRegistrationIdentityVerificationFailureMessage(
          reason,
          result.message,
        ),
        reason,
        status: 'failure',
      };
    } catch (error) {
      const linkFailureReason = resolveStudentRegistrationLinkFailureReasonFromError(error);

      if (linkFailureReason) {
        return {
          canProceed: false,
          message: resolveStudentRegistrationIdentityVerificationFailureMessage(linkFailureReason),
          reason: linkFailureReason,
          status: 'failure',
        };
      }

      if (isStudentRegistrationIdentityMismatchError(error)) {
        return {
          canProceed: false,
          message: '身份信息不匹配，请核对后重试。',
          reason: 'IDENTITY_MISMATCH',
          status: 'failure',
        };
      }

      return {
        status: 'error',
        message: resolvePublicAuthErrorMessage(error, '暂时无法核对身份信息。'),
      };
    }
  },
  async verifyStudentRegistrationAccount(
    input,
  ): Promise<StudentRegistrationAccountVerificationResult> {
    try {
      const response = await requestGraphQL<
        VerifyStudentRegistrationAccountResponse,
        {
          input: {
            loginName?: string;
            loginPassword: string;
            nickname?: string;
            token: string;
          };
        }
      >(VERIFY_STUDENT_REGISTRATION_ACCOUNT_MUTATION, {
        input: {
          loginName: normalizeOptionalText(input.loginName),
          loginPassword: input.loginPassword,
          nickname: normalizeOptionalText(input.nickname),
          token: input.token.trim(),
        },
      });
      const result = response.verifyStudentRegistrationAccount;

      if (result.success && result.canProceed === true) {
        return {
          canProceed: true,
          message: result.message ?? null,
          status: 'success',
        };
      }

      if (!result.reason) {
        return {
          status: 'error',
          message: result.message || '暂时无法校验账号信息。',
        };
      }

      return {
        canProceed: false,
        message: resolveStudentRegistrationAccountVerificationFailureMessage(
          result.reason,
          result.message,
        ),
        reason: result.reason,
        status: 'failure',
      };
    } catch (error) {
      const linkFailureReason = resolveStudentRegistrationLinkFailureReasonFromError(error);

      if (linkFailureReason) {
        return {
          canProceed: false,
          message: resolveStudentRegistrationAccountVerificationFailureMessage(linkFailureReason),
          reason: linkFailureReason,
          status: 'failure',
        };
      }

      return {
        status: 'error',
        message: resolvePublicAuthErrorMessage(error, '暂时无法校验账号信息。'),
      };
    }
  },
  async consumeStudentRegistrationLink(input): Promise<StudentRegistrationConsumptionResult> {
    try {
      const mutationInput = {
        idCardLastSix: input.idCardLastSix.trim(),
        loginEmail: input.loginEmail.trim(),
        loginName: normalizeOptionalText(input.loginName),
        loginPassword: input.loginPassword,
        name: input.name.trim(),
        nickname: normalizeOptionalText(input.nickname),
        studentId: input.studentId.trim(),
        token: input.token.trim(),
      };
      const response = await requestGraphQL<
        ConsumeStudentRegistrationLinkResponse,
        {
          input: {
            idCardLastSix: string;
            loginEmail: string;
            loginName?: string;
            loginPassword: string;
            name: string;
            nickname?: string;
            studentId: string;
            token: string;
          };
        }
      >(CONSUME_STUDENT_REGISTRATION_LINK_MUTATION, {
        input: mutationInput,
      });
      const result = response.consumeStudentRegistrationLink;

      if (!result.success) {
        return {
          status: 'failure',
          message: result.message || '暂时无法完成学生注册。',
        };
      }

      return {
        accountId: result.accountId ?? null,
        accountStatus: result.accountStatus ?? null,
        emailVerificationRequired: result.emailVerificationRequired ?? true,
        emailVerificationSent: result.emailVerificationSent ?? false,
        loginEmail: result.loginEmail || input.loginEmail.trim(),
        message: result.message ?? null,
        status: 'success',
      };
    } catch (error) {
      if (isStudentRegistrationIdentityMismatchError(error)) {
        return {
          status: 'identity-mismatch',
          message: '身份信息不匹配，请核对后重试。',
        };
      }

      const linkFailureReason = resolveStudentRegistrationLinkFailureReasonFromError(error);

      if (linkFailureReason) {
        return {
          status: 'link-failure',
          reason: linkFailureReason,
          message: resolveStudentRegistrationLinkFailureMessage(linkFailureReason),
        };
      }

      return {
        status: 'error',
        message: resolvePublicAuthErrorMessage(error, '暂时无法完成学生注册。'),
      };
    }
  },
  async verifyLoginEmail(input): Promise<LoginEmailVerificationResult> {
    try {
      const normalizedToken = input.token.trim();

      if (!normalizedToken) {
        return {
          loginEmail: null,
          status: 'failure',
          reason: 'INVALID',
          message: resolveLoginEmailVerificationFailureMessage('INVALID'),
        };
      }

      const response = await requestGraphQL<
        VerifyLoginEmailResponse,
        {
          input: {
            token: string;
          };
        }
      >(VERIFY_LOGIN_EMAIL_MUTATION, {
        input: {
          token: normalizedToken,
        },
      });
      const result = response.verifyLoginEmail;

      if (result.success) {
        return {
          accountId: result.accountId ?? null,
          loginEmail: result.loginEmail ?? null,
          message: result.message ?? null,
          status: 'success',
        };
      }

      const reason = result.reason || 'INVALID';

      return {
        loginEmail: result.loginEmail ?? null,
        status: 'failure',
        reason,
        message: resolveLoginEmailVerificationFailureMessage(reason, result.message),
      };
    } catch (error) {
      return {
        status: 'error',
        message: resolvePublicAuthErrorMessage(error, '暂时无法完成登录邮箱验证。'),
      };
    }
  },
  async resendLoginEmailVerification(input): Promise<ResendLoginEmailVerificationResult> {
    try {
      const response = await requestGraphQL<
        ResendLoginEmailVerificationResponse,
        {
          input: {
            loginEmail: string;
          };
        }
      >(RESEND_LOGIN_EMAIL_VERIFICATION_MUTATION, {
        input: {
          loginEmail: input.loginEmail.trim(),
        },
      });
      const result = response.resendLoginEmailVerification;

      if (result.success) {
        return {
          status: 'success',
          message: result.message ?? null,
        };
      }

      return {
        status: 'error',
        message: result.message || '暂时无法发送验证邮件，请稍后再试。',
      };
    } catch (error) {
      return {
        status: 'error',
        message: resolvePublicAuthErrorMessage(error, '暂时无法发送验证邮件，请稍后再试。'),
      };
    }
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
