import {
  readUpstreamGraphQLErrorDetail,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { includesAnyPattern } from '@/shared/string';

export const INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH = 'INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH';
export const UPSTREAM_SESSION_STAFF_MISMATCH = 'UPSTREAM_SESSION_STAFF_MISMATCH';

const UPSTREAM_STAFF_SCOPE_MISMATCH = 'UPSTREAM_STAFF_SCOPE_MISMATCH';
const INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT = 'INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT';
const INTEGRATED_CROSS_DAY_CONSUMPTION = 'INTEGRATED_CROSS_DAY_CONSUMPTION';
const INTEGRATED_CROSS_WEEK_CONSUMPTION = 'INTEGRATED_CROSS_WEEK_CONSUMPTION';

export function isUpstreamSessionStaffMismatchIssue(value: string | null | undefined) {
  return value === UPSTREAM_SESSION_STAFF_MISMATCH;
}

export function resolveLectureJournalIssueMessage(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value === UPSTREAM_STAFF_SCOPE_MISMATCH) {
    return '当前上游会话无法获取该教师的教学计划，或上游返回的计划负责人不匹配。';
  }

  if (isUpstreamSessionStaffMismatchIssue(value)) {
    return '当前校园网登录用户与查询教师不一致，本次按所选教师展示对账结果。';
  }

  // Ownership issue codes are exact warning values; integrated allocation codes may be embedded
  // in longer backend messages, so they intentionally use contains-style matching.
  if (
    includesAnyPattern(value, [
      INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT,
      INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH,
    ])
  ) {
    return '一体化计划明细需要的课时数超过当前本地课表中可顺序分配的有效课时数，请检查本地学期课表、教学周历或计划明细课时后再重试。';
  }

  if (value.includes(INTEGRATED_CROSS_DAY_CONSUMPTION)) {
    return '一体化计划明细的课时分配会跨教学日期，请确认本地课表与计划明细课时符合实际后再填写。';
  }

  if (value.includes(INTEGRATED_CROSS_WEEK_CONSUMPTION)) {
    return '一体化计划明细的课时分配会跨教学周，请确认本地课表与计划明细课时符合实际后再填写。';
  }

  return null;
}

export function resolveLectureJournalUpstreamErrorMessage(error: unknown, fallback: string) {
  const detail = readUpstreamGraphQLErrorDetail(error);
  // Some upstream GraphQL failures currently put the symbolic issue code only in message.
  const knownMessage = [
    detail?.code,
    detail?.errorCode,
    detail?.message,
    error instanceof Error ? error.message : null,
  ]
    .map((candidate) => resolveLectureJournalIssueMessage(candidate))
    .find((message): message is string => Boolean(message));

  if (knownMessage) {
    return knownMessage;
  }

  return resolveUpstreamErrorMessage(error, fallback);
}
