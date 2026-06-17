// src/features/student-roster-membership-reconciliation/application/confirmation-policy.ts

import type {
  StudentRosterMembershipConfirmationInput,
  StudentRosterMembershipDecisionOutcome,
  StudentRosterMembershipEndDecisionInput,
  StudentRosterMembershipReasonCode,
  StudentRosterMembershipReconciliationItem,
} from './types';

export type ConfirmationDecisionOption = {
  decisionOutcome: StudentRosterMembershipDecisionOutcome;
  defaultReasonCode: StudentRosterMembershipReasonCode;
  label: string;
  reasonOptions: StudentRosterMembershipReasonCode[];
};

export type ConfirmationDraft = {
  decisionOutcome: StudentRosterMembershipDecisionOutcome;
  effectiveSemesterId?: number | null;
  reasonCode: StudentRosterMembershipReasonCode;
  reasonText?: string;
};

export type EndDecisionDraft = {
  endReason?: string;
  selected: boolean;
};

export type PreRegisteredReviewOutcome = 'PRE_REGISTERED' | 'NOT_CHECKED_IN' | 'DROPPED';

export type PreRegisteredReviewDraft = {
  effectiveSemesterId?: number | null;
  note?: string;
  outcome?: PreRegisteredReviewOutcome;
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
  END_INCLUDE_DECISION_AVAILABLE: '可撤销本地裁定',
  END_EXCLUDE_DECISION_AVAILABLE: '可撤销本地裁定',
  ENSURE_MEMBERSHIP: '建立/刷新归属',
  INFERRED_MEMBERSHIP_REQUIRES_CONFIRMATION: '需确认推断归属',
  MISSING_REQUIRES_CONFIRMATION: '需确认缺失',
  NO_CHANGE: '无变化',
  SUPPRESSED_BY_EXCLUDE_DECISION: '本地排除裁定压制',
  SUPPRESSED_BY_INCLUDE_DECISION: '本地保留裁定保留',
  TRANSFER_IN_REQUIRES_CONFIRMATION: '需确认转入',
};

export const DECISION_OUTCOME_LABELS: Record<StudentRosterMembershipDecisionOutcome, string> = {
  EXCLUDE: '不在本班就读',
  INCLUDE: '在本班就读',
};

export const DECISION_OUTCOME_COLORS = {
  EXCLUDE: 'orange',
  INCLUDE: 'blue',
} as const;

export const REASON_CODE_LABELS: Record<StudentRosterMembershipReasonCode, string> = {
  CLASS_MEMBERSHIP_CORRECTION: '班级归属修正',
  DROPPED_CONFIRMED: '确认报到后退学',
  NOT_CHECKED_IN_CONFIRMED: '确认未报到且不再报到',
  REENROLLED_CONFIRMED: '确认复学转入当前班',
  RETAINED_GRADE_CONFIRMED: '确认留级至当前班',
  TRANSFERRED_IN_CONFIRMED: '确认平级转入当前班',
  TRANSFERRED_OUT_CONFIRMED: '确认转出',
  UPSTREAM_ROSTER_ERROR_CONFIRMED: '确认 upstream 名册异常',
};

export const EFFECTIVE_SEMESTER_LABELS: Record<StudentRosterMembershipReasonCode, string> = {
  CLASS_MEMBERSHIP_CORRECTION: '裁定生效学期',
  DROPPED_CONFIRMED: '退学起始学期',
  NOT_CHECKED_IN_CONFIRMED: '裁定生效学期',
  REENROLLED_CONFIRMED: '进入当前班生效学期',
  RETAINED_GRADE_CONFIRMED: '进入当前班生效学期',
  TRANSFERRED_IN_CONFIRMED: '进入当前班生效学期',
  TRANSFERRED_OUT_CONFIRMED: '转出当前班生效学期',
  UPSTREAM_ROSTER_ERROR_CONFIRMED: '裁定生效学期',
};

export const EFFECTIVE_SEMESTER_HELP_TEXTS: Partial<
  Record<StudentRosterMembershipReasonCode, string>
> = {
  DROPPED_CONFIRMED: '从该学期起按退学处理；成绩仅记录到上一个学期。',
};

const TRANSFER_IN_CONFIRMATION_OPTIONS: ConfirmationDecisionOption[] = [
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
      'NOT_CHECKED_IN_CONFIRMED',
      'DROPPED_CONFIRMED',
      'CLASS_MEMBERSHIP_CORRECTION',
    ],
  },
  {
    decisionOutcome: 'INCLUDE',
    defaultReasonCode: 'UPSTREAM_ROSTER_ERROR_CONFIRMED',
    label: '仍在本班就读',
    reasonOptions: ['UPSTREAM_ROSTER_ERROR_CONFIRMED', 'CLASS_MEMBERSHIP_CORRECTION'],
  },
];

export function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function getConfirmationDecisionOptions(action: string): ConfirmationDecisionOption[] {
  if (
    action === 'TRANSFER_IN_REQUIRES_CONFIRMATION' ||
    action === 'INFERRED_MEMBERSHIP_REQUIRES_CONFIRMATION'
  ) {
    return TRANSFER_IN_CONFIRMATION_OPTIONS;
  }

  if (action === 'MISSING_REQUIRES_CONFIRMATION') {
    return MISSING_CONFIRMATION_OPTIONS;
  }

  return [];
}

export function canEndDecision(item: StudentRosterMembershipReconciliationItem) {
  return (
    (item.action === 'END_INCLUDE_DECISION_AVAILABLE' ||
      item.action === 'END_EXCLUDE_DECISION_AVAILABLE') &&
    Boolean(item.activeDecisionId)
  );
}

export function requiresEffectiveSemester(
  reasonCode: StudentRosterMembershipReasonCode | null | undefined,
) {
  return reasonCode !== 'NOT_CHECKED_IN_CONFIRMED';
}

export function getEffectiveSemesterLabel(
  reasonCode: StudentRosterMembershipReasonCode | null | undefined,
) {
  return reasonCode ? EFFECTIVE_SEMESTER_LABELS[reasonCode] : '裁定生效学期';
}

export function getEffectiveSemesterHelpText(
  reasonCode: StudentRosterMembershipReasonCode | null | undefined,
) {
  return reasonCode ? (EFFECTIVE_SEMESTER_HELP_TEXTS[reasonCode] ?? null) : null;
}

export function isPreRegisteredUpstreamStatus(item: StudentRosterMembershipReconciliationItem) {
  return item.isEnrolled === '0';
}

export function requiresNotReportedOrDroppedConfirmation(
  item: StudentRosterMembershipReconciliationItem,
) {
  return (
    item.requiresConfirmation &&
    (item.recommendedReasonCode === 'NOT_CHECKED_IN_CONFIRMED' ||
      item.recommendedReasonCode === 'DROPPED_CONFIRMED')
  );
}

export function requiresPreRegisteredLocalReview(item: StudentRosterMembershipReconciliationItem) {
  return (
    item.category === 'AUTO_APPLY' &&
    isPreRegisteredUpstreamStatus(item) &&
    !item.requiresConfirmation
  );
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
    effectiveSemesterId: undefined,
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

export function buildDefaultPreRegisteredReviewDrafts(
  items: readonly StudentRosterMembershipReconciliationItem[],
  options?: {
    resolveItemKey?: (item: StudentRosterMembershipReconciliationItem) => string;
  },
) {
  const resolveItemKey = options?.resolveItemKey ?? ((item) => item.key);

  return items.reduce<Record<string, PreRegisteredReviewDraft>>((drafts, item) => {
    if (requiresPreRegisteredLocalReview(item)) {
      drafts[resolveItemKey(item)] = {
        outcome: 'PRE_REGISTERED',
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

    if (
      !item.studentId ||
      !draft ||
      (requiresEffectiveSemester(draft.reasonCode) && !draft.effectiveSemesterId)
    ) {
      invalidItems.push(item);
      continue;
    }

    confirmations.push({
      decisionOutcome: draft.decisionOutcome,
      effectiveSemesterId: draft.effectiveSemesterId ?? undefined,
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

export function buildPreRegisteredReviewCommitPayload(
  items: readonly StudentRosterMembershipReconciliationItem[],
  drafts: Record<string, PreRegisteredReviewDraft>,
  options?: {
    resolveItemKey?: (item: StudentRosterMembershipReconciliationItem) => string;
  },
) {
  const resolveItemKey = options?.resolveItemKey ?? ((item) => item.key);
  const confirmations: StudentRosterMembershipConfirmationInput[] = [];
  const endDecisions: StudentRosterMembershipEndDecisionInput[] = [];
  const invalidItems: StudentRosterMembershipReconciliationItem[] = [];
  const overriddenItems: StudentRosterMembershipReconciliationItem[] = [];

  for (const item of items) {
    if (!requiresPreRegisteredLocalReview(item)) {
      continue;
    }

    const draft = drafts[resolveItemKey(item)];

    if (draft?.outcome !== 'NOT_CHECKED_IN' && draft?.outcome !== 'DROPPED') {
      continue;
    }

    overriddenItems.push(item);

    const reasonCode: StudentRosterMembershipReasonCode =
      draft.outcome === 'NOT_CHECKED_IN' ? 'NOT_CHECKED_IN_CONFIRMED' : 'DROPPED_CONFIRMED';

    if (!item.studentId || (requiresEffectiveSemester(reasonCode) && !draft.effectiveSemesterId)) {
      invalidItems.push(item);
      continue;
    }

    const reasonText = draft.note?.trim() || undefined;

    confirmations.push({
      decisionOutcome: 'EXCLUDE',
      effectiveSemesterId: draft.effectiveSemesterId ?? undefined,
      reasonCode,
      reasonText,
      studentId: item.studentId,
    });

    if (item.activeDecisionId) {
      endDecisions.push({
        decisionId: item.activeDecisionId,
        endReason: reasonText,
      });
    }
  }

  return {
    confirmations,
    endDecisions,
    invalidItems,
    overriddenItems,
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

export function mergeCommitEndDecisions(
  ...decisionGroups: readonly StudentRosterMembershipEndDecisionInput[][]
) {
  const merged = new Map<string, StudentRosterMembershipEndDecisionInput>();

  for (const decision of decisionGroups.flat()) {
    const current = merged.get(decision.decisionId);

    if (!current) {
      merged.set(decision.decisionId, decision);
      continue;
    }

    if (!current.endReason && decision.endReason) {
      merged.set(decision.decisionId, decision);
    }
  }

  return [...merged.values()];
}
