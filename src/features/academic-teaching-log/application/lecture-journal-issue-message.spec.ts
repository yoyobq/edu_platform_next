import type { GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import {
  isUpstreamSessionStaffMismatchIssue,
  resolveLectureJournalIssueMessage,
  resolveLectureJournalUpstreamErrorMessage,
} from './lecture-journal-issue-message';

function buildGraphQLError(extensions: Record<string, unknown>): GraphQLFormattedError {
  return {
    extensions,
    message: String(extensions.errorMessage || extensions.errorCode || extensions.code || 'error'),
  };
}

describe('lecture journal issue message', () => {
  it('explains military training without requiring a blocking action', () => {
    expect(resolveLectureJournalIssueMessage('MILITARY_TRAINING_WITH_UPSTREAM_PLAN')).toBe(
      '该日期涉及新生军训，按本地教学周历应扣减课时，但校园网教学计划中仍安排了上课，请按计划照常填写，与结算课时无关。',
    );
  });

  it.each([
    'PLANNED_OCCURRENCE_PROJECTION_INVALID',
    'STAFF_ID_MISMATCH',
    'IDENTITY_COLLISION',
    'CALENDAR_EVENT_DATE_OUT_OF_SEMESTER',
    'SCHEDULE_OCCURRENCE_DATE_OUT_OF_SEMESTER',
    'CALENDAR_EVENT_CALC_CONFLICT',
  ])('shows source failure %s instead of hiding it or reporting insufficient hours', (issue) => {
    expect(resolveLectureJournalIssueMessage(issue)).toBe(
      '本地课表或教学周历数据异常，无法可靠生成计划课次，请检查后重试。',
    );
  });

  it('shows a missing semester source as a configuration issue', () => {
    expect(resolveLectureJournalIssueMessage('ACADEMIC_SEMESTER_TARGET_NOT_FOUND')).toBe(
      '无法确定教学计划对应的本地学期，请检查学期配置后重试。',
    );
  });

  it('maps integrated occurrence hour shortage issue strings to actionable guidance', () => {
    expect(resolveLectureJournalIssueMessage('INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT')).toBe(
      '一体化计划明细需要的课时数超过当前本地课表中可顺序分配的有效课时数，请检查本地学期课表、教学周历或计划明细课时后再重试。',
    );
  });

  it('keeps ownership warnings exact while allowing integrated issue codes in longer messages', () => {
    expect(isUpstreamSessionStaffMismatchIssue('UPSTREAM_SESSION_STAFF_MISMATCH')).toBe(true);
    expect(isUpstreamSessionStaffMismatchIssue('UPSTREAM_SESSION_STAFF_MISMATCH: context')).toBe(
      false,
    );
    expect(resolveLectureJournalIssueMessage('INTEGRATED_CROSS_DAY_CONSUMPTION: context')).toBe(
      '一体化计划明细的课时分配会跨教学日期，请确认本地课表与计划明细课时符合实际后再填写。',
    );
  });

  it('maps upstream staff scope mismatch to a teaching plan ownership message', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'UPSTREAM_STAFF_SCOPE_MISMATCH',
        }),
      ],
      message: 'UPSTREAM_STAFF_SCOPE_MISMATCH',
      type: 'graphql',
    });

    expect(resolveLectureJournalUpstreamErrorMessage(error, 'fallback')).toBe(
      '当前上游会话无法获取该教师的教学计划，或上游返回的计划负责人不匹配。',
    );
  });

  it('maps upstream session staff mismatch to a non-blocking ownership warning message', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'UPSTREAM_SESSION_STAFF_MISMATCH',
        }),
      ],
      message: 'UPSTREAM_SESSION_STAFF_MISMATCH',
      type: 'graphql',
    });

    expect(resolveLectureJournalUpstreamErrorMessage(error, 'fallback')).toBe(
      '当前校园网登录用户与查询教师不一致，本次按所选教师展示对账结果。',
    );
  });

  it('maps integrated occurrence hour shortage when the backend only returns message', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        {
          message: 'INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT',
        },
      ],
      message: 'INTEGRATED_OCCURRENCE_HOURS_INSUFFICIENT',
      type: 'graphql',
    });

    expect(resolveLectureJournalUpstreamErrorMessage(error, 'fallback')).toBe(
      '一体化计划明细需要的课时数超过当前本地课表中可顺序分配的有效课时数，请检查本地学期课表、教学周历或计划明细课时后再重试。',
    );
  });

  it('maps integrated journal occurrence mismatch to the same allocation guidance', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          code: 'INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH',
        }),
      ],
      message: 'INTEGRATED_JOURNAL_OCCURRENCE_MISMATCH',
      type: 'graphql',
    });

    expect(resolveLectureJournalUpstreamErrorMessage(error, 'fallback')).toBe(
      '一体化计划明细需要的课时数超过当前本地课表中可顺序分配的有效课时数，请检查本地学期课表、教学周历或计划明细课时后再重试。',
    );
  });

  it('maps integrated cross day consumption to a fill check warning message', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'INTEGRATED_CROSS_DAY_CONSUMPTION',
        }),
      ],
      message: 'INTEGRATED_CROSS_DAY_CONSUMPTION',
      type: 'graphql',
    });

    expect(resolveLectureJournalUpstreamErrorMessage(error, 'fallback')).toBe(
      '一体化计划明细的课时分配会跨教学日期，请确认本地课表与计划明细课时符合实际后再填写。',
    );
  });

  it('maps integrated cross week consumption to a fill check warning message', () => {
    const error = new GraphQLIngressError({
      graphqlErrors: [
        buildGraphQLError({
          errorCode: 'INTEGRATED_CROSS_WEEK_CONSUMPTION',
        }),
      ],
      message: 'INTEGRATED_CROSS_WEEK_CONSUMPTION',
      type: 'graphql',
    });

    expect(resolveLectureJournalUpstreamErrorMessage(error, 'fallback')).toBe(
      '一体化计划明细的课时分配会跨教学周，请确认本地课表与计划明细课时符合实际后再填写。',
    );
  });
});
