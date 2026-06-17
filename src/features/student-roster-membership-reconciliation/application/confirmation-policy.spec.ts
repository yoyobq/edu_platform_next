// src/features/student-roster-membership-reconciliation/application/confirmation-policy.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildCommitConfirmations,
  buildDefaultConfirmationDraft,
  buildDefaultConfirmationDrafts,
  buildDefaultPreRegisteredReviewDrafts,
  buildDefaultReplacementDecisionDrafts,
  buildPreRegisteredReviewCommitPayload,
  buildReplacementDecisionCommitPayload,
  canEndDecision,
  getConfirmationDecisionOptions,
  getEffectiveSemesterHelpText,
  getEffectiveSemesterLabel,
  mergeCommitEndDecisions,
  REASON_CODE_LABELS,
  switchConfirmationDraftDecisionOutcome,
  updateConfirmationDraftEffectiveSemester,
  updateConfirmationDraftReasonCode,
} from './confirmation-policy';
import type { StudentRosterMembershipReconciliationItem } from './types';

function buildItem(
  overrides: Partial<StudentRosterMembershipReconciliationItem>,
): StudentRosterMembershipReconciliationItem {
  return {
    action: 'NO_CHANGE',
    activeDecisionId: null,
    activeDecisionEffectiveSemesterId: null,
    activeDecisionOutcome: null,
    activeDecisionReasonCode: null,
    category: 'AUTO_APPLY',
    classCode: '1031301',
    className: '信息1301班',
    currentClassCode: null,
    currentClassName: null,
    currentMembershipId: null,
    inferredAdmissionYear: null,
    inferredOriginalClassCode: null,
    inferredOriginalClassSeq: null,
    inferredTargetClassSeq: null,
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
        reasonOptions: [
          'TRANSFERRED_IN_CONFIRMED',
          'REENROLLED_CONFIRMED',
          'RETAINED_GRADE_CONFIRMED',
          'CLASS_MEMBERSHIP_CORRECTION',
        ],
      },
      {
        decisionOutcome: 'EXCLUDE',
        defaultReasonCode: 'UPSTREAM_ROSTER_ERROR_CONFIRMED',
        label: '不在本班就读',
        reasonOptions: [
          'UPSTREAM_ROSTER_ERROR_CONFIRMED',
          'NOT_CHECKED_IN_CONFIRMED',
          'DROPPED_CONFIRMED',
          'CLASS_MEMBERSHIP_CORRECTION',
        ],
      },
    ]);
  });

  it('uses transfer-like options for inferred membership confirmations', () => {
    const item = buildItem({
      action: 'INFERRED_MEMBERSHIP_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      recommendedDecisionOutcome: 'INCLUDE',
      recommendedReasonCode: 'RETAINED_GRADE_CONFIRMED',
      requiresConfirmation: true,
    });

    expect(getConfirmationDecisionOptions(item.action)).toEqual(
      getConfirmationDecisionOptions('TRANSFER_IN_REQUIRES_CONFIRMATION'),
    );
    expect(buildDefaultConfirmationDraft(item)).toMatchObject({
      decisionOutcome: 'INCLUDE',
      effectiveSemesterId: undefined,
      reasonCode: 'RETAINED_GRADE_CONFIRMED',
      reasonText: undefined,
    });
  });

  it('uses backend recommendation when it matches the action option set', () => {
    const item = buildItem({
      action: 'MISSING_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      recommendedDecisionOutcome: 'EXCLUDE',
      recommendedReasonCode: 'DROPPED_CONFIRMED',
      requiresConfirmation: true,
    });

    expect(buildDefaultConfirmationDraft(item)).toMatchObject({
      decisionOutcome: 'EXCLUDE',
      effectiveSemesterId: undefined,
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
    expect(REASON_CODE_LABELS.NOT_CHECKED_IN_CONFIRMED).toBe('确认未报到且不再报到');
    expect(REASON_CODE_LABELS.DROPPED_CONFIRMED).toBe('确认报到后退学');
  });

  it('uses reason-specific effective semester copy for dropout decisions', () => {
    expect(getEffectiveSemesterLabel('DROPPED_CONFIRMED')).toBe('退学起始学期');
    expect(getEffectiveSemesterHelpText('DROPPED_CONFIRMED')).toBe(
      '从该学期起按退学处理；成绩仅记录到上一个学期。',
    );
    expect(getEffectiveSemesterLabel('TRANSFERRED_IN_CONFIRMED')).toBe('进入当前班生效学期');
    expect(getEffectiveSemesterHelpText('TRANSFERRED_IN_CONFIRMED')).toBeNull();
  });

  it('falls back to the action default when recommendation is outside the allowed reason set', () => {
    const item = buildItem({
      action: 'TRANSFER_IN_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      recommendedDecisionOutcome: 'INCLUDE',
      recommendedReasonCode: 'DROPPED_CONFIRMED',
      requiresConfirmation: true,
    });

    expect(buildDefaultConfirmationDraft(item)).toMatchObject({
      decisionOutcome: 'INCLUDE',
      effectiveSemesterId: undefined,
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
    drafts.valid.effectiveSemesterId = 3;

    expect(buildCommitConfirmations([validItem, invalidItem], drafts)).toEqual({
      confirmations: [
        {
          decisionOutcome: 'EXCLUDE',
          effectiveSemesterId: 3,
          reasonCode: 'TRANSFERRED_OUT_CONFIRMED',
          reasonText: undefined,
          studentId: '20240001',
        },
      ],
      invalidItems: [invalidItem],
    });
  });

  it('requires effective semester for manual confirmations except not checked in', () => {
    const transferredOutItem = buildItem({
      action: 'MISSING_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      key: 'transferred-out',
      recommendedDecisionOutcome: 'EXCLUDE',
      recommendedReasonCode: 'TRANSFERRED_OUT_CONFIRMED',
      requiresConfirmation: true,
      studentId: '20240001',
    });
    const notCheckedInItem = buildItem({
      action: 'MISSING_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      key: 'not-checked-in',
      recommendedDecisionOutcome: 'EXCLUDE',
      recommendedReasonCode: 'NOT_CHECKED_IN_CONFIRMED',
      requiresConfirmation: true,
      studentId: '20240002',
    });
    const drafts = buildDefaultConfirmationDrafts([transferredOutItem, notCheckedInItem]);

    expect(buildCommitConfirmations([transferredOutItem, notCheckedInItem], drafts)).toEqual({
      confirmations: [
        {
          decisionOutcome: 'EXCLUDE',
          effectiveSemesterId: undefined,
          reasonCode: 'NOT_CHECKED_IN_CONFIRMED',
          reasonText: undefined,
          studentId: '20240002',
        },
      ],
      invalidItems: [transferredOutItem],
    });
  });

  it('builds replacement confirmations and end decisions for end-decision-available items', () => {
    const includeEndableItem = buildItem({
      action: 'END_INCLUDE_DECISION_AVAILABLE',
      activeDecisionId: '12',
      category: 'SUPPRESSED',
      key: 'include-endable',
    });
    const excludeEndableItem = buildItem({
      action: 'END_EXCLUDE_DECISION_AVAILABLE',
      activeDecisionId: '13',
      category: 'SUPPRESSED',
      key: 'exclude-endable',
    });
    const suppressedItem = buildItem({
      action: 'SUPPRESSED_BY_EXCLUDE_DECISION',
      activeDecisionId: '14',
      category: 'SUPPRESSED',
      key: 'suppressed',
    });
    const drafts = buildDefaultReplacementDecisionDrafts([
      includeEndableItem,
      excludeEndableItem,
      suppressedItem,
    ]);

    expect(canEndDecision(includeEndableItem)).toBe(true);
    expect(canEndDecision(excludeEndableItem)).toBe(true);
    expect(canEndDecision(suppressedItem)).toBe(false);
    expect(drafts).toEqual({
      'include-endable': expect.objectContaining({
        decisionOutcome: 'EXCLUDE',
        reasonCode: 'TRANSFERRED_OUT_CONFIRMED',
        selected: false,
      }),
      'exclude-endable': expect.objectContaining({
        decisionOutcome: 'INCLUDE',
        reasonCode: 'TRANSFERRED_IN_CONFIRMED',
        selected: false,
      }),
    });
    expect(
      buildReplacementDecisionCommitPayload(
        [includeEndableItem, excludeEndableItem, suppressedItem],
        {
          'exclude-endable': {
            ...drafts['exclude-endable'],
            effectiveSemesterId: 4,
            reasonText: ' 已重新确认在读 ',
            selected: true,
          },
          'include-endable': {
            ...drafts['include-endable'],
            effectiveSemesterId: 3,
            reasonText: ' upstream 已确认转出 ',
            selected: true,
          },
        },
      ),
    ).toEqual({
      confirmations: [
        {
          decisionOutcome: 'EXCLUDE',
          effectiveSemesterId: 3,
          reasonCode: 'TRANSFERRED_OUT_CONFIRMED',
          reasonText: 'upstream 已确认转出',
          studentId: '20240001',
        },
        {
          decisionOutcome: 'INCLUDE',
          effectiveSemesterId: 4,
          reasonCode: 'TRANSFERRED_IN_CONFIRMED',
          reasonText: '已重新确认在读',
          studentId: '20240001',
        },
      ],
      endDecisions: [
        {
          decisionId: '12',
          endReason: 'upstream 已确认转出',
        },
        {
          decisionId: '13',
          endReason: '已重新确认在读',
        },
      ],
      invalidItems: [],
      replacedItems: [includeEndableItem, excludeEndableItem],
    });
  });

  it('remembers confirmation reason and semester per decision outcome', () => {
    const item = buildItem({
      action: 'MISSING_REQUIRES_CONFIRMATION',
      recommendedDecisionOutcome: 'EXCLUDE',
      recommendedReasonCode: 'TRANSFERRED_OUT_CONFIRMED',
      requiresConfirmation: true,
    });
    const options = getConfirmationDecisionOptions(item.action);
    const includeOption = options.find((option) => option.decisionOutcome === 'INCLUDE');
    const excludeOption = options.find((option) => option.decisionOutcome === 'EXCLUDE');
    const initialDraft = buildDefaultConfirmationDraft(item);

    expect(initialDraft).toMatchObject({
      decisionOutcome: 'EXCLUDE',
      reasonCode: 'TRANSFERRED_OUT_CONFIRMED',
    });
    expect(includeOption).toBeDefined();
    expect(excludeOption).toBeDefined();

    const transferredOutDraft = updateConfirmationDraftEffectiveSemester(
      updateConfirmationDraftReasonCode(initialDraft!, 'DROPPED_CONFIRMED'),
      3,
    );
    const includeDraft = switchConfirmationDraftDecisionOutcome(
      transferredOutDraft,
      includeOption!,
    );
    const upstreamErrorDraft = updateConfirmationDraftEffectiveSemester(includeDraft, 4);
    const restoredExcludeDraft = switchConfirmationDraftDecisionOutcome(
      upstreamErrorDraft,
      excludeOption!,
    );

    expect(restoredExcludeDraft).toMatchObject({
      decisionOutcome: 'EXCLUDE',
      effectiveSemesterId: 3,
      reasonCode: 'DROPPED_CONFIRMED',
    });
  });

  it('reports replacement decisions invalid without required effective semester', () => {
    const includeEndableItem = buildItem({
      action: 'END_INCLUDE_DECISION_AVAILABLE',
      activeDecisionId: '12',
      category: 'SUPPRESSED',
      key: 'include-endable',
    });
    const drafts = buildDefaultReplacementDecisionDrafts([includeEndableItem]);

    expect(
      buildReplacementDecisionCommitPayload([includeEndableItem], {
        'include-endable': {
          ...drafts['include-endable'],
          selected: true,
        },
      }),
    ).toEqual({
      confirmations: [],
      endDecisions: [],
      invalidItems: [includeEndableItem],
      replacedItems: [includeEndableItem],
    });
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
            effectiveSemesterId: 3,
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
          effectiveSemesterId: undefined,
          reasonCode: 'NOT_CHECKED_IN_CONFIRMED',
          reasonText: '已确认不再报到',
          studentId: '20240002',
        },
        {
          decisionOutcome: 'EXCLUDE',
          effectiveSemesterId: 3,
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

  it('does not treat IS_ENROLLED=0 class-change rows as optional pre-registered reviews', () => {
    const classChangeItem = buildItem({
      category: 'UNPROCESSABLE',
      currentClassCode: '1031201',
      currentClassName: '信息1201班',
      isEnrolled: '0',
      key: 'class-change',
      reason:
        '上游 roster 返回该学生且 IS_ENROLLED=0，但本地当前归属在其他班；当前版本不自动迁入或退学',
      requiresConfirmation: false,
    });

    expect(buildDefaultPreRegisteredReviewDrafts([classChangeItem])).toEqual({});
    expect(
      buildPreRegisteredReviewCommitPayload([classChangeItem], {
        'class-change': {
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
