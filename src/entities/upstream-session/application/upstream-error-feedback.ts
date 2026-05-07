import { isGraphQLIngressError } from '@/shared/graphql';

type UpstreamGraphQLErrorDetail = {
  code: string | null;
  errorCode: string | null;
  message: string | null;
};

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getReadableGraphQLMessage(detail: UpstreamGraphQLErrorDetail | null): string | null {
  if (!detail?.message) {
    return null;
  }

  if (detail.message === detail.code || detail.message === detail.errorCode) {
    return null;
  }

  return detail.message;
}

function getKnownUpstreamErrorMessage(
  error: unknown,
  detail: UpstreamGraphQLErrorDetail | null,
): string | null {
  if (hasErrorCodeOrMessage(error, detail, ['UPSTREAM_STAFF_SCOPE_MISMATCH'])) {
    return '当前上游会话无法获取该教师的教学计划，或上游返回的计划负责人不匹配。';
  }

  if (hasErrorCodeOrMessage(error, detail, ['UPSTREAM_SESSION_STAFF_MISMATCH'])) {
    return '当前校园网登录用户与查询教师不一致，本次按所选教师展示对账结果。';
  }

  if (
    hasErrorCodeOrMessage(error, detail, [
      'INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT',
      'INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH',
    ])
  ) {
    return '一体化计划明细需要的课时数超过当前本地课表中可顺序分配的有效课时数，请检查本地学期课表、教学周历或计划明细课时后再重试。';
  }

  if (hasErrorCodeOrMessage(error, detail, ['INTEGRATED_CROSS_DAY_CONSUMPTION'])) {
    return '一体化计划明细的课时分配会跨教学日期，请确认本地课表与计划明细课时符合实际后再填写。';
  }

  if (hasErrorCodeOrMessage(error, detail, ['INTEGRATED_CROSS_WEEK_CONSUMPTION'])) {
    return '一体化计划明细的课时分配会跨教学周，请确认本地课表与计划明细课时符合实际后再填写。';
  }

  return null;
}

function includesAnyPattern(value: string | null, patterns: readonly string[]): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();

  return patterns.some((pattern) => normalizedValue.includes(pattern.toLowerCase()));
}

function hasErrorCode(
  detail: UpstreamGraphQLErrorDetail | null,
  errorCodes: readonly string[],
): boolean {
  return Boolean(
    (detail?.code && errorCodes.includes(detail.code)) ||
    (detail?.errorCode && errorCodes.includes(detail.errorCode)),
  );
}

function hasErrorCodeOrMessage(
  error: unknown,
  detail: UpstreamGraphQLErrorDetail | null,
  errorCodes: readonly string[],
): boolean {
  if (hasErrorCode(detail, errorCodes)) {
    return true;
  }

  return matchesMessage(error, detail, errorCodes);
}

function matchesMessage(
  error: unknown,
  detail: UpstreamGraphQLErrorDetail | null,
  patterns: readonly string[],
): boolean {
  if (includesAnyPattern(getReadableGraphQLMessage(detail), patterns)) {
    return true;
  }

  return includesAnyPattern(error instanceof Error ? error.message : null, patterns);
}

export function readUpstreamGraphQLErrorDetail(error: unknown): UpstreamGraphQLErrorDetail | null {
  if (!isGraphQLIngressError(error) || !error.graphqlErrors?.length) {
    return null;
  }

  const [firstError] = error.graphqlErrors;
  const extensions = (firstError.extensions as Record<string, unknown> | undefined) || {};

  return {
    code: normalizeOptionalString(extensions.code),
    errorCode: normalizeOptionalString(extensions.errorCode),
    message:
      normalizeOptionalString(extensions.errorMessage) ||
      normalizeOptionalString(firstError.message),
  };
}

export function isExpiredUpstreamSessionError(error: unknown): boolean {
  const detail = readUpstreamGraphQLErrorDetail(error);

  if (isGraphQLIngressError(error) && (error.type === 'auth' || error.statusCode === 401)) {
    return true;
  }

  if (hasErrorCode(detail, ['UPSTREAM_ACCESS_AUTH_REQUIRED', 'UPSTREAM_ACCESS_SESSION_EXPIRED'])) {
    return true;
  }

  return matchesMessage(error, detail, [
    '上游会话已失效',
    'upstream 会话已失效',
    '上游登录态已失效',
    '上游身份核对已失效',
    '请重新登录 upstream',
    '请重新登录上游',
    '请先完成上游身份核对',
  ]);
}

export function resolveUpstreamErrorMessage(error: unknown, fallback: string): string {
  const detail = readUpstreamGraphQLErrorDetail(error);
  const knownMessage = getKnownUpstreamErrorMessage(error, detail);

  if (knownMessage) {
    return knownMessage;
  }

  const graphQLMessage = getReadableGraphQLMessage(detail);

  if (graphQLMessage) {
    return graphQLMessage;
  }

  if (isGraphQLIngressError(error)) {
    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export function resolveStaffInviteUpstreamErrorMessage(error: unknown, fallback: string): string {
  const detail = readUpstreamGraphQLErrorDetail(error);
  const graphQLMessage = getReadableGraphQLMessage(detail);

  if (graphQLMessage) {
    return graphQLMessage;
  }

  if (
    hasErrorCode(detail, ['EMAIL_TAKEN']) ||
    matchesMessage(error, detail, ['邀请邮箱已被注册', '邀请邮箱已经被注册', '邮箱已被注册'])
  ) {
    return '邀请邮箱已被注册，请直接返回登录页或联系管理员处理。';
  }

  if (
    hasErrorCode(detail, ['UPSTREAM_ACCESS_AUTH_FAILED']) ||
    matchesMessage(error, detail, [
      '上游账号或密码不正确',
      '上游账号或密码错误',
      '用户名或密码错误',
      '账号或密码错误',
    ])
  ) {
    return '上游账号或密码不正确，请重新核对。';
  }

  if (isExpiredUpstreamSessionError(error)) {
    return '上游会话已失效，请重新进行身份核对。';
  }

  if (
    hasErrorCode(detail, ['INVITE_EMAIL_MISMATCH_WITH_IDENTITY', 'INVITE_EMAIL_MISMATCH']) ||
    hasErrorCode(detail, [
      'INVITE_IDENTITY_MISMATCH_WITH_INVITE',
      'INVITE_STAFF_ID_MISMATCH',
      'INVITE_STAFF_NAME_MISMATCH',
    ]) ||
    matchesMessage(error, detail, [
      '当前教职工身份与邀请不一致',
      '身份与邀请不一致',
      '身份与邀请不匹配',
      '工号与邀请不一致',
      '工号与邀请不匹配',
      '邀请邮箱与身份不一致',
      '邀请邮箱与身份不匹配',
    ])
  ) {
    return '当前教职工身份与邀请不一致，该邀请已不可继续使用。';
  }

  if (isGraphQLIngressError(error)) {
    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}
