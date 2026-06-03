// src/labs/student-roster-membership-reconciliation/confirmation-policy.spec.ts

import { describe, expect, it } from 'vitest';

import type { StudentRosterMembershipReconciliationItem } from './api';
import {
  buildCommitConfirmations,
  buildCommitEndDecisions,
  buildDefaultConfirmationDraft,
  buildDefaultConfirmationDrafts,
  buildDefaultEndDecisionDrafts,
  canEndDecision,
  getConfirmationDecisionOptions,
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
        label: '确认属于本班',
        reasonOptions: ['TRANSFERRED_IN_CONFIRMED', 'CLASS_MEMBERSHIP_CORRECTION'],
      },
      {
        decisionOutcome: 'EXCLUDE',
        defaultReasonCode: 'UPSTREAM_ROSTER_ERROR_CONFIRMED',
        label: '确认不属于本班',
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
        'DROPPED_CONFIRMED',
        'CLASS_MEMBERSHIP_CORRECTION',
      ],
    });
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
});
