// src/labs/student-roster-membership-reconciliation/result-view-model.ts

import type { StudentRosterMembershipReconciliationItem } from './api';
import {
  canEndDecision,
  getActionLabel,
  isPreRegisteredUpstreamStatus,
  REASON_CODE_LABELS,
  requiresPreRegisteredLocalReview,
} from './confirmation-policy';

export type RosterReviewKind =
  | 'required-confirmation'
  | 'enrollment-review'
  | 'local-decision'
  | 'data-issue'
  | 'automatic';

export type RosterReviewItem = {
  blocking: boolean;
  businessDetail: string | null;
  businessSummary: string;
  commitImpactLabel: string;
  defaultOperationLabel: string;
  item: StudentRosterMembershipReconciliationItem;
  kind: RosterReviewKind;
  priority: number;
  rowKey: string;
};

export const ROSTER_REVIEW_KIND_LABELS: Record<RosterReviewKind, string> = {
  automatic: '自动处理',
  'data-issue': '数据异常',
  'enrollment-review': '预报到复核',
  'local-decision': '本地裁定',
  'required-confirmation': '必须确认',
};

export const ROSTER_REVIEW_KIND_COLORS: Record<RosterReviewKind, string> = {
  automatic: 'green',
  'data-issue': 'orange',
  'enrollment-review': 'warning',
  'local-decision': 'blue',
  'required-confirmation': 'gold',
};

export const ROSTER_REVIEW_KIND_ORDER: RosterReviewKind[] = [
  'required-confirmation',
  'enrollment-review',
  'local-decision',
  'data-issue',
  'automatic',
];

const ROSTER_REVIEW_KIND_PRIORITY: Record<RosterReviewKind, number> = {
  automatic: 50,
  'data-issue': 40,
  'enrollment-review': 20,
  'local-decision': 30,
  'required-confirmation': 10,
};

function getTargetClassLabel(item: StudentRosterMembershipReconciliationItem) {
  return `${item.className} / ${item.classCode}`;
}

function getStudentIdSortValue(item: StudentRosterMembershipReconciliationItem) {
  if (!item.studentId || !/^\d+$/.test(item.studentId)) {
    return null;
  }

  return Number(item.studentId);
}

function resolveReviewKind(item: StudentRosterMembershipReconciliationItem): RosterReviewKind {
  if (item.requiresConfirmation) {
    return 'required-confirmation';
  }

  if (item.category === 'SUPPRESSED' || canEndDecision(item)) {
    return 'local-decision';
  }

  if (requiresPreRegisteredLocalReview(item)) {
    return 'enrollment-review';
  }

  if (item.category === 'UNPROCESSABLE') {
    return 'data-issue';
  }

  return 'automatic';
}

function buildRequiredConfirmationSummary(item: StudentRosterMembershipReconciliationItem) {
  if (item.action === 'TRANSFER_IN_REQUIRES_CONFIRMATION') {
    return item.currentClassCode
      ? `上游在当前班返回，本地当前归属为 ${item.currentClassCode}，需确认是否转入。`
      : '上游在当前班返回，但本地没有当前班归属，需确认是否为当前班学生。';
  }

  if (item.action === 'MISSING_REQUIRES_CONFIRMATION') {
    return '本地仍有当前班 active 归属，但本次上游名单未返回，需确认保留或结束归属。';
  }

  return '后端要求人工确认该归属差异。';
}

function buildRequiredConfirmationDetail(item: StudentRosterMembershipReconciliationItem) {
  const recommendedReason = item.recommendedReasonCode
    ? REASON_CODE_LABELS[item.recommendedReasonCode]
    : null;

  if (recommendedReason) {
    return `默认原因：${recommendedReason}`;
  }

  return item.reason;
}

function buildBusinessSummary(
  item: StudentRosterMembershipReconciliationItem,
  kind: RosterReviewKind,
) {
  switch (kind) {
    case 'required-confirmation':
      return buildRequiredConfirmationSummary(item);
    case 'enrollment-review':
      return '校园网显示该生未报到，实际情况可能并不一致。';
    case 'local-decision':
      if (canEndDecision(item)) {
        return '已有本地保留裁定，且上游已恢复返回，可选择结束该裁定。';
      }

      return '已有本地裁定，上游返回不会自动覆盖；本次不重复提醒。';
    case 'data-issue':
      return item.reason ?? '上游数据异常，当前无法自动处理。';
    case 'automatic':
      if (item.action === 'NO_CHANGE') {
        return item.reason ?? '上游与本地当前归属一致。';
      }

      if (item.action === 'ENSURE_MEMBERSHIP') {
        return isPreRegisteredUpstreamStatus(item)
          ? '校园网显示该生未报到，提交后建立或刷新当前班预报到归属。'
          : '上游返回当前班学生，提交后建立或刷新当前班归属。';
      }

      return getActionLabel(item.action);
  }
}

function buildBusinessDetail(
  item: StudentRosterMembershipReconciliationItem,
  kind: RosterReviewKind,
) {
  switch (kind) {
    case 'required-confirmation':
      return buildRequiredConfirmationDetail(item);
    case 'enrollment-review':
      return '请人工判断：保留新生预报到状态，或确认该生不再报到、已经退学。';
    case 'local-decision':
      return null;
    case 'data-issue':
      return item.upstreamStudentId ? `upstreamStudentId：${item.upstreamStudentId}` : null;
    case 'automatic':
      if (item.action === 'NO_CHANGE') {
        return null;
      }

      return item.reason;
  }
}

function buildDefaultOperationLabel(
  item: StudentRosterMembershipReconciliationItem,
  kind: RosterReviewKind,
) {
  switch (kind) {
    case 'required-confirmation':
      return '提交所选确认';
    case 'enrollment-review':
      return '保留预报到';
    case 'local-decision':
      return canEndDecision(item) ? '可结束裁定' : '保持当前裁定';
    case 'data-issue':
      return '仅观察';
    case 'automatic':
      return '无需人工处理';
  }
}

function buildCommitImpactLabel(
  item: StudentRosterMembershipReconciliationItem,
  kind: RosterReviewKind,
) {
  switch (kind) {
    case 'required-confirmation':
      return '提交时记录确认';
    case 'enrollment-review':
      return '改判后记录裁定';
    case 'local-decision':
      return canEndDecision(item) ? '勾选后结束裁定' : '本地裁定不变';
    case 'data-issue':
      return '不自动处理';
    case 'automatic':
      return item.action === 'NO_CHANGE' ? '无需记录决策' : '提交时自动处理';
  }
}

export function buildRosterReviewItem(
  item: StudentRosterMembershipReconciliationItem,
  rowKey: string,
): RosterReviewItem {
  const kind = resolveReviewKind(item);

  return {
    blocking: kind === 'required-confirmation',
    businessDetail: buildBusinessDetail(item, kind),
    businessSummary: buildBusinessSummary(item, kind),
    commitImpactLabel: buildCommitImpactLabel(item, kind),
    defaultOperationLabel: buildDefaultOperationLabel(item, kind),
    item,
    kind,
    priority: ROSTER_REVIEW_KIND_PRIORITY[kind],
    rowKey,
  };
}

export function buildRosterReviewItems(
  items: readonly StudentRosterMembershipReconciliationItem[],
  getRowKey: (item: StudentRosterMembershipReconciliationItem) => string,
) {
  return items
    .map((item) => buildRosterReviewItem(item, getRowKey(item)))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      const leftStudentId = getStudentIdSortValue(left.item);
      const rightStudentId = getStudentIdSortValue(right.item);

      if (leftStudentId !== null && rightStudentId !== null && leftStudentId !== rightStudentId) {
        return leftStudentId - rightStudentId;
      }

      if (leftStudentId !== null && rightStudentId === null) {
        return -1;
      }

      if (leftStudentId === null && rightStudentId !== null) {
        return 1;
      }

      return left.rowKey.localeCompare(right.rowKey);
    });
}

export function isFocusedRosterReviewItem(item: RosterReviewItem) {
  if (item.kind === 'automatic') {
    return false;
  }

  if (item.kind === 'local-decision') {
    return canEndDecision(item.item);
  }

  return true;
}

export function filterRosterReviewItems(
  items: readonly RosterReviewItem[],
  filter: RosterReviewKind | 'all' | 'focus',
) {
  if (filter === 'all') {
    return [...items];
  }

  if (filter === 'focus') {
    return items.filter(isFocusedRosterReviewItem);
  }

  return items.filter((item) => item.kind === filter);
}

export function countRosterReviewItemsByKind(items: readonly RosterReviewItem[]) {
  return items.reduce<Record<RosterReviewKind, number>>(
    (counts, item) => {
      counts[item.kind] += 1;
      return counts;
    },
    {
      automatic: 0,
      'data-issue': 0,
      'enrollment-review': 0,
      'local-decision': 0,
      'required-confirmation': 0,
    },
  );
}

export function getTargetClassSummary(item: StudentRosterMembershipReconciliationItem) {
  return getTargetClassLabel(item);
}
