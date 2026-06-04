// src/labs/student-roster-membership-reconciliation/confirmation-policy.ts

import type {
  StudentRosterMembershipConfirmationInput,
  StudentRosterMembershipDecisionOutcome,
  StudentRosterMembershipEndDecisionInput,
  StudentRosterMembershipReasonCode,
  StudentRosterMembershipReconciliationItem,
} from './api';

export type ConfirmationDecisionOption = {
  decisionOutcome: StudentRosterMembershipDecisionOutcome;
  defaultReasonCode: StudentRosterMembershipReasonCode;
  label: string;
  reasonOptions: StudentRosterMembershipReasonCode[];
};

export type ConfirmationDraft = {
  decisionOutcome: StudentRosterMembershipDecisionOutcome;
  reasonCode: StudentRosterMembershipReasonCode;
  reasonText?: string;
};

export type EndDecisionDraft = {
  endReason?: string;
  selected: boolean;
};

export const CATEGORY_LABELS = {
  AUTO_APPLY: '自动处理',
  DIFFERENCE: '归属差异',
  SUPPRESSED: '本地裁定',
  UNPROCESSABLE: '不可处理',
} as const;

export const CATEGORY_COLORS = {
  AUTO_APPLY: 'green',
  DIFFERENCE: 'gold',
  SUPPRESSED: 'blue',
  UNPROCESSABLE: 'orange',
} as const;

export const ACTION_LABELS: Record<string, string> = {
  END_INCLUDE_DECISION_AVAILABLE: '可结束 INCLUDE 裁定',
  ENSURE_MEMBERSHIP: '建立/刷新归属',
  MISSING_REQUIRES_CONFIRMATION: '需确认缺失',
  NO_CHANGE: '无变化',
  SUPPRESSED_BY_EXCLUDE_DECISION: 'EXCLUDE 裁定压制',
  SUPPRESSED_BY_INCLUDE_DECISION: 'INCLUDE 裁定保留',
  TRANSFER_IN_REQUIRES_CONFIRMATION: '需确认转入',
};

export const DECISION_OUTCOME_LABELS: Record<StudentRosterMembershipDecisionOutcome, string> = {
  EXCLUDE: '确认不属于本班',
  INCLUDE: '确认属于本班',
};

export const REASON_CODE_LABELS: Record<StudentRosterMembershipReasonCode, string> = {
  CLASS_MEMBERSHIP_CORRECTION: '班级归属修正',
  DROPPED_CONFIRMED: '确认未报到或退学（保留历史归属）',
  TRANSFERRED_IN_CONFIRMED: '确认转入',
  TRANSFERRED_OUT_CONFIRMED: '确认转出',
  UPSTREAM_ROSTER_ERROR_CONFIRMED: '确认 upstream 名册异常',
};

const TRANSFER_IN_CONFIRMATION_OPTIONS: ConfirmationDecisionOption[] = [
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
];

const MISSING_CONFIRMATION_OPTIONS: ConfirmationDecisionOption[] = [
  {
    decisionOutcome: 'EXCLUDE',
    defaultReasonCode: 'TRANSFERRED_OUT_CONFIRMED',
    label: '结束当前归属',
    reasonOptions: [
      'TRANSFERRED_OUT_CONFIRMED',
      'DROPPED_CONFIRMED',
      'CLASS_MEMBERSHIP_CORRECTION',
    ],
  },
  {
    decisionOutcome: 'INCLUDE',
    defaultReasonCode: 'UPSTREAM_ROSTER_ERROR_CONFIRMED',
    label: '确认仍属于本班',
    reasonOptions: ['UPSTREAM_ROSTER_ERROR_CONFIRMED', 'CLASS_MEMBERSHIP_CORRECTION'],
  },
];

export function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function getConfirmationDecisionOptions(action: string): ConfirmationDecisionOption[] {
  if (action === 'TRANSFER_IN_REQUIRES_CONFIRMATION') {
    return TRANSFER_IN_CONFIRMATION_OPTIONS;
  }

  if (action === 'MISSING_REQUIRES_CONFIRMATION') {
    return MISSING_CONFIRMATION_OPTIONS;
  }

  return [];
}

export function canEndDecision(item: StudentRosterMembershipReconciliationItem) {
  return item.action === 'END_INCLUDE_DECISION_AVAILABLE' && Boolean(item.activeDecisionId);
}

export function buildDefaultConfirmationDraft(
  item: StudentRosterMembershipReconciliationItem,
): ConfirmationDraft | null {
  const options = getConfirmationDecisionOptions(item.action);

  if (!item.requiresConfirmation || options.length === 0) {
    return null;
  }

  const selectedOption =
    options.find((option) => option.decisionOutcome === item.recommendedDecisionOutcome) ??
    options[0];
  const reasonCode =
    item.recommendedReasonCode && selectedOption.reasonOptions.includes(item.recommendedReasonCode)
      ? item.recommendedReasonCode
      : selectedOption.defaultReasonCode;

  return {
    decisionOutcome: selectedOption.decisionOutcome,
    reasonCode,
    reasonText: undefined,
  };
}

export function buildDefaultConfirmationDrafts(
  items: readonly StudentRosterMembershipReconciliationItem[],
) {
  return items.reduce<Record<string, ConfirmationDraft>>((drafts, item) => {
    const draft = buildDefaultConfirmationDraft(item);

    if (draft) {
      drafts[item.key] = draft;
    }

    return drafts;
  }, {});
}

export function buildDefaultEndDecisionDrafts(
  items: readonly StudentRosterMembershipReconciliationItem[],
) {
  return items.reduce<Record<string, EndDecisionDraft>>((drafts, item) => {
    if (canEndDecision(item)) {
      drafts[item.key] = {
        selected: false,
      };
    }

    return drafts;
  }, {});
}

export function buildCommitConfirmations(
  items: readonly StudentRosterMembershipReconciliationItem[],
  drafts: Record<string, ConfirmationDraft>,
) {
  const confirmations: StudentRosterMembershipConfirmationInput[] = [];
  const invalidItems: StudentRosterMembershipReconciliationItem[] = [];

  for (const item of items) {
    if (!item.requiresConfirmation) {
      continue;
    }

    const draft = drafts[item.key];

    if (!item.studentId || !draft) {
      invalidItems.push(item);
      continue;
    }

    confirmations.push({
      decisionOutcome: draft.decisionOutcome,
      reasonCode: draft.reasonCode,
      reasonText: draft.reasonText?.trim() || undefined,
      studentId: item.studentId,
    });
  }

  return {
    confirmations,
    invalidItems,
  };
}

export function buildCommitEndDecisions(
  items: readonly StudentRosterMembershipReconciliationItem[],
  drafts: Record<string, EndDecisionDraft>,
) {
  return items.reduce<StudentRosterMembershipEndDecisionInput[]>((endDecisions, item) => {
    const draft = drafts[item.key];

    if (!draft?.selected || !canEndDecision(item) || !item.activeDecisionId) {
      return endDecisions;
    }

    endDecisions.push({
      decisionId: item.activeDecisionId,
      endReason: draft.endReason?.trim() || undefined,
    });

    return endDecisions;
  }, []);
}
