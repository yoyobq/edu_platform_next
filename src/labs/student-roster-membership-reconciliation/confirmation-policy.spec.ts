// src/labs/student-roster-membership-reconciliation/confirmation-policy.spec.ts

import { describe, expect, it } from 'vitest';

import type { StudentRosterMembershipReconciliationItem } from './api';
import {
  buildCommitConfirmations,
  buildCommitEndDecisions,
  buildDefaultConfirmationDraft,
  buildDefaultConfirmationDrafts,
  buildDefaultEndDecisionDrafts,
  buildDefaultPreRegisteredReviewDrafts,
  buildPreRegisteredReviewCommitPayload,
  canEndDecision,
  getConfirmationDecisionOptions,
  mergeCommitEndDecisions,
  REASON_CODE_LABELS,
} from './confirmation-policy';

function buildItem(
  overrides: Partial<StudentRosterMembershipReconciliationItem>,
): StudentRosterMembershipReconciliationItem {
  return {
    action: 'NO_CHANGE',
    activeDecisionId: null,
    activeDecisionOutcome: null,
    category: 'AUTO_APPLY',
    classCode: '1031301',
    className: '信息1301班',
    currentClassCode: null,
    currentClassName: null,
    currentMembershipId: null,
    isEnrolled: null,
    isInSchool: null,
    key: 'item-1',
    reason: null,
    recommendedDecisionOutcome: null,
    recommendedReasonCode: null,
    requiresConfirmation: false,
    rowIndex: null,
    studentId: '20240001',
    studentName: '张三',
    studentStatus: null,
    upstreamClassCode: null,
    upstreamClassName: null,
    upstreamPresence: 'UNKNOWN',
    upstreamStudentId: null,
    ...overrides,
  };
}

describe('student roster membership confirmation policy', () => {
  it('constrains transfer-in confirmations to the product-approved options', () => {
    const options = getConfirmationDecisionOptions('TRANSFER_IN_REQUIRES_CONFIRMATION');

    expect(options).toEqual([
      {
        decisionOutcome: 'INCLUDE',
        defaultReasonCode: 'TRANSFERRED_IN_CONFIRMED',
        label: '在本班就读',
        reasonOptions: ['TRANSFERRED_IN_CONFIRMED', 'CLASS_MEMBERSHIP_CORRECTION'],
      },
      {
        decisionOutcome: 'EXCLUDE',
        defaultReasonCode: 'UPSTREAM_ROSTER_ERROR_CONFIRMED',
        label: '不在本班就读',
        reasonOptions: ['UPSTREAM_ROSTER_ERROR_CONFIRMED', 'CLASS_MEMBERSHIP_CORRECTION'],
      },
    ]);
  });

  it('uses backend recommendation when it matches the action option set', () => {
    const item = buildItem({
      action: 'MISSING_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      recommendedDecisionOutcome: 'EXCLUDE',
      recommendedReasonCode: 'DROPPED_CONFIRMED',
      requiresConfirmation: true,
    });

    expect(buildDefaultConfirmationDraft(item)).toEqual({
      decisionOutcome: 'EXCLUDE',
      reasonCode: 'DROPPED_CONFIRMED',
      reasonText: undefined,
    });
  });

  it('labels missing confirmations as ending current membership, not erasing class history', () => {
    const options = getConfirmationDecisionOptions('MISSING_REQUIRES_CONFIRMATION');

    expect(options[0]).toEqual({
      decisionOutcome: 'EXCLUDE',
      defaultReasonCode: 'TRANSFERRED_OUT_CONFIRMED',
      label: '结束当前归属',
      reasonOptions: [
        'TRANSFERRED_OUT_CONFIRMED',
        'NOT_CHECKED_IN_CONFIRMED',
        'DROPPED_CONFIRMED',
        'CLASS_MEMBERSHIP_CORRECTION',
      ],
    });
  });

  it('distinguishes not reported from active class membership history in reason labels', () => {
    expect(REASON_CODE_LABELS.NOT_CHECKED_IN_CONFIRMED).toBe('确认未报到且不来了');
    expect(REASON_CODE_LABELS.DROPPED_CONFIRMED).toBe('确认报到后退学');
  });

  it('falls back to the action default when recommendation is outside the allowed reason set', () => {
    const item = buildItem({
      action: 'TRANSFER_IN_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      recommendedDecisionOutcome: 'INCLUDE',
      recommendedReasonCode: 'DROPPED_CONFIRMED',
      requiresConfirmation: true,
    });

    expect(buildDefaultConfirmationDraft(item)).toEqual({
      decisionOutcome: 'INCLUDE',
      reasonCode: 'TRANSFERRED_IN_CONFIRMED',
      reasonText: undefined,
    });
  });

  it('builds commit confirmations for all required items and reports invalid rows', () => {
    const validItem = buildItem({
      action: 'MISSING_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      key: 'valid',
      recommendedDecisionOutcome: 'EXCLUDE',
      recommendedReasonCode: 'TRANSFERRED_OUT_CONFIRMED',
      requiresConfirmation: true,
      studentId: '20240001',
    });
    const invalidItem = buildItem({
      action: 'TRANSFER_IN_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      key: 'invalid',
      recommendedDecisionOutcome: 'INCLUDE',
      recommendedReasonCode: 'TRANSFERRED_IN_CONFIRMED',
      requiresConfirmation: true,
      studentId: null,
    });
    const drafts = buildDefaultConfirmationDrafts([validItem, invalidItem]);

    expect(buildCommitConfirmations([validItem, invalidItem], drafts)).toEqual({
      confirmations: [
        {
          decisionOutcome: 'EXCLUDE',
          reasonCode: 'TRANSFERRED_OUT_CONFIRMED',
          reasonText: undefined,
          studentId: '20240001',
        },
      ],
      invalidItems: [invalidItem],
    });
  });

  it('only allows explicit ending for END_INCLUDE_DECISION_AVAILABLE items', () => {
    const endableItem = buildItem({
      action: 'END_INCLUDE_DECISION_AVAILABLE',
      activeDecisionId: '12',
      category: 'SUPPRESSED',
      key: 'endable',
    });
    const suppressedItem = buildItem({
      action: 'SUPPRESSED_BY_EXCLUDE_DECISION',
      activeDecisionId: '13',
      category: 'SUPPRESSED',
      key: 'suppressed',
    });
    const drafts = buildDefaultEndDecisionDrafts([endableItem, suppressedItem]);

    expect(canEndDecision(endableItem)).toBe(true);
    expect(canEndDecision(suppressedItem)).toBe(false);
    expect(drafts).toEqual({
      endable: {
        selected: false,
      },
    });
    expect(
      buildCommitEndDecisions([endableItem, suppressedItem], {
        endable: {
          endReason: ' upstream 已恢复返回 ',
          selected: true,
        },
        suppressed: {
          selected: true,
        },
      }),
    ).toEqual([
      {
        decisionId: '12',
        endReason: 'upstream 已恢复返回',
      },
    ]);
  });

  it('builds optional NOT_CHECKED_IN and DROPPED confirmations for reviewed IS_ENROLLED=0 auto items', () => {
    const preRegisteredItem = buildItem({
      isEnrolled: '0',
      key: 'pre-registered',
      requiresConfirmation: false,
      studentId: '20240001',
    });
    const notCheckedInItem = buildItem({
      isEnrolled: '0',
      key: 'not-checked-in',
      requiresConfirmation: false,
      studentId: '20240002',
    });
    const droppedItem = buildItem({
      activeDecisionId: 'decision-1',
      isEnrolled: '0',
      key: 'dropped',
      requiresConfirmation: false,
      studentId: '20240003',
    });
    const ignoredRequiredItem = buildItem({
      isEnrolled: '0',
      key: 'required',
      recommendedReasonCode: 'DROPPED_CONFIRMED',
      requiresConfirmation: true,
      studentId: '20240004',
    });

    expect(
      buildPreRegisteredReviewCommitPayload(
        [preRegisteredItem, notCheckedInItem, droppedItem, ignoredRequiredItem],
        {
          dropped: {
            note: ' 已确认报到后退学 ',
            outcome: 'DROPPED',
          },
          'not-checked-in': {
            note: ' 已确认不再报到 ',
            outcome: 'NOT_CHECKED_IN',
          },
          'pre-registered': {
            outcome: 'PRE_REGISTERED',
          },
          required: {
            outcome: 'DROPPED',
          },
        },
      ),
    ).toEqual({
      confirmations: [
        {
          decisionOutcome: 'EXCLUDE',
          reasonCode: 'NOT_CHECKED_IN_CONFIRMED',
          reasonText: '已确认不再报到',
          studentId: '20240002',
        },
        {
          decisionOutcome: 'EXCLUDE',
          reasonCode: 'DROPPED_CONFIRMED',
          reasonText: '已确认报到后退学',
          studentId: '20240003',
        },
      ],
      endDecisions: [
        {
          decisionId: 'decision-1',
          endReason: '已确认报到后退学',
        },
      ],
      invalidItems: [],
      overriddenItems: [notCheckedInItem, droppedItem],
    });
  });

  it('defaults optional IS_ENROLLED=0 review items to PRE_REGISTERED without confirmations', () => {
    const preRegisteredItem = buildItem({
      isEnrolled: '0',
      key: 'pre-registered',
      requiresConfirmation: false,
      studentId: '20240001',
    });
    const drafts = buildDefaultPreRegisteredReviewDrafts([preRegisteredItem]);

    expect(drafts).toEqual({
      'pre-registered': {
        outcome: 'PRE_REGISTERED',
      },
    });
    expect(buildPreRegisteredReviewCommitPayload([preRegisteredItem], drafts)).toEqual({
      confirmations: [],
      endDecisions: [],
      invalidItems: [],
      overriddenItems: [],
    });
  });

  it('does not treat SUPPRESSED IS_ENROLLED=0 rows as optional pre-registered reviews', () => {
    const suppressedItem = buildItem({
      activeDecisionId: 'decision-1',
      activeDecisionOutcome: 'EXCLUDE',
      category: 'SUPPRESSED',
      isEnrolled: '0',
      key: 'suppressed',
      requiresConfirmation: false,
    });

    expect(buildDefaultPreRegisteredReviewDrafts([suppressedItem])).toEqual({});
    expect(
      buildPreRegisteredReviewCommitPayload([suppressedItem], {
        suppressed: {
          outcome: 'DROPPED',
        },
      }),
    ).toEqual({
      confirmations: [],
      endDecisions: [],
      invalidItems: [],
      overriddenItems: [],
    });
  });

  it('reports invalid optional EXCLUDE confirmations when studentId is missing', () => {
    const invalidItem = buildItem({
      isEnrolled: '0',
      key: 'invalid',
      requiresConfirmation: false,
      studentId: null,
    });

    expect(
      buildPreRegisteredReviewCommitPayload([invalidItem], {
        invalid: {
          outcome: 'DROPPED',
        },
      }),
    ).toEqual({
      confirmations: [],
      endDecisions: [],
      invalidItems: [invalidItem],
      overriddenItems: [invalidItem],
    });
  });

  it('deduplicates end decisions while preserving explicit end reasons', () => {
    expect(
      mergeCommitEndDecisions(
        [
          {
            decisionId: '12',
            endReason: undefined,
          },
        ],
        [
          {
            decisionId: '12',
            endReason: '人工确认退学',
          },
          {
            decisionId: '13',
            endReason: undefined,
          },
        ],
      ),
    ).toEqual([
      {
        decisionId: '12',
        endReason: '人工确认退学',
      },
      {
        decisionId: '13',
        endReason: undefined,
      },
    ]);
  });
});
