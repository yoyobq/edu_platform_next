// src/features/student-roster-membership-reconciliation/application/result-view-model.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildRosterReviewItems,
  countRosterReviewItemsByKind,
  filterRosterReviewItems,
} from './result-view-model';
import type { StudentRosterMembershipReconciliationItem } from './types';

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

describe('student roster membership result view model', () => {
  it('groups roster rows by the human review task instead of backend category only', () => {
    const requiredItem = buildItem({
      action: 'TRANSFER_IN_REQUIRES_CONFIRMATION',
      category: 'DIFFERENCE',
      currentClassCode: '1031201',
      key: 'required',
      recommendedDecisionOutcome: 'INCLUDE',
      recommendedReasonCode: 'TRANSFERRED_IN_CONFIRMED',
      requiresConfirmation: true,
    });
    const enrollmentReviewItem = buildItem({
      isEnrolled: '0',
      key: 'enrollment-review',
    });
    const localDecisionItem = buildItem({
      action: 'END_INCLUDE_DECISION_AVAILABLE',
      activeDecisionId: 'decision-1',
      activeDecisionOutcome: 'INCLUDE',
      category: 'SUPPRESSED',
      key: 'local-decision',
    });
    const dataIssueItem = buildItem({
      category: 'UNPROCESSABLE',
      key: 'data-issue',
      reason: '缺少学号',
      studentId: null,
    });
    const automaticItem = buildItem({
      action: 'ENSURE_MEMBERSHIP',
      key: 'automatic',
    });

    const reviewItems = buildRosterReviewItems(
      [automaticItem, dataIssueItem, localDecisionItem, enrollmentReviewItem, requiredItem],
      (item) => item.key,
    );

    expect(reviewItems.map((item) => item.kind)).toEqual([
      'required-confirmation',
      'enrollment-review',
      'local-decision',
      'data-issue',
      'automatic',
    ]);
    expect(reviewItems[0]).toMatchObject({
      blocking: true,
      commitImpactLabel: '提交时记录确认',
      defaultOperationLabel: '提交所选确认',
    });
    expect(reviewItems[1]).toMatchObject({
      blocking: false,
      businessDetail: '请人工判断：保留新生预报到状态，或确认该生不再报到、已经退学。',
      businessSummary: '校园网显示该生未报到，实际情况可能并不一致。',
      commitImpactLabel: '改判后记录裁定',
      defaultOperationLabel: '保留预报到',
    });
  });

  it('sorts rows with the same priority by numeric studentId and keeps invalid ids last', () => {
    const reviewItems = buildRosterReviewItems(
      [
        buildItem({
          key: 'student-10',
          studentId: '10',
        }),
        buildItem({
          key: 'student-2',
          studentId: '2',
        }),
        buildItem({
          key: 'student-missing',
          studentId: null,
        }),
        buildItem({
          key: 'student-text',
          studentId: 'A001',
        }),
      ],
      (item) => item.key,
    );

    expect(reviewItems.map((item) => item.rowKey)).toEqual([
      'student-2',
      'student-10',
      'student-missing',
      'student-text',
    ]);
  });

  it('keeps focus on non-automatic rows and counts every review kind', () => {
    const reviewItems = buildRosterReviewItems(
      [
        buildItem({
          key: 'automatic',
        }),
        buildItem({
          isEnrolled: '0',
          key: 'enrollment-review',
        }),
        buildItem({
          category: 'UNPROCESSABLE',
          isEnrolled: '0',
          key: 'data-issue',
        }),
      ],
      (item) => item.key,
    );

    expect(filterRosterReviewItems(reviewItems, 'focus').map((item) => item.kind)).toEqual([
      'enrollment-review',
      'data-issue',
    ]);
    expect(countRosterReviewItemsByKind(reviewItems)).toEqual({
      automatic: 1,
      'data-issue': 1,
      'enrollment-review': 1,
      'local-decision': 0,
      'required-confirmation': 0,
    });
  });

  it('keeps IS_ENROLLED=0 class-change rows as data issues', () => {
    const reviewItems = buildRosterReviewItems(
      [
        buildItem({
          category: 'UNPROCESSABLE',
          currentClassCode: '1031201',
          currentClassName: '信息1201班',
          isEnrolled: '0',
          key: 'class-change-not-enrolled',
          reason:
            '上游 roster 返回该学生且 IS_ENROLLED=0，但本地当前归属在其他班；当前版本不自动迁入或退学',
        }),
      ],
      (item) => item.key,
    );

    expect(reviewItems[0]).toMatchObject({
      businessSummary:
        '上游 roster 返回该学生且 IS_ENROLLED=0，但本地当前归属在其他班；当前版本不自动迁入或退学',
      commitImpactLabel: '不自动处理',
      defaultOperationLabel: '仅观察',
      kind: 'data-issue',
    });
  });

  it('prioritizes active local decisions over IS_ENROLLED=0 review prompts', () => {
    const reviewItems = buildRosterReviewItems(
      [
        buildItem({
          activeDecisionId: 'decision-1',
          activeDecisionOutcome: 'EXCLUDE',
          category: 'SUPPRESSED',
          isEnrolled: '0',
          key: 'suppressed-pre-registered',
        }),
      ],
      (item) => item.key,
    );

    expect(reviewItems[0]).toMatchObject({
      blocking: false,
      businessDetail: null,
      businessSummary: '已有本地裁定，上游返回不会自动覆盖；本次不重复提醒。',
      commitImpactLabel: '本地裁定不变',
      defaultOperationLabel: '保持当前裁定',
      kind: 'local-decision',
    });
  });

  it('uses the no-change backend reason as the single business summary', () => {
    const reviewItems = buildRosterReviewItems(
      [
        buildItem({
          action: 'NO_CHANGE',
          key: 'no-change',
          reason: '上游 roster 与本地当前班级归属一致',
        }),
      ],
      (item) => item.key,
    );

    expect(reviewItems[0]).toMatchObject({
      businessDetail: null,
      businessSummary: '上游 roster 与本地当前班级归属一致',
      kind: 'automatic',
    });
  });

  it('keeps suppressed local decisions out of focus unless they can be ended', () => {
    const reviewItems = buildRosterReviewItems(
      [
        buildItem({
          action: 'SUPPRESSED_BY_EXCLUDE_DECISION',
          activeDecisionId: 'decision-1',
          activeDecisionOutcome: 'EXCLUDE',
          category: 'SUPPRESSED',
          key: 'suppressed',
        }),
        buildItem({
          action: 'END_INCLUDE_DECISION_AVAILABLE',
          activeDecisionId: 'decision-2',
          activeDecisionOutcome: 'INCLUDE',
          category: 'SUPPRESSED',
          key: 'endable',
        }),
      ],
      (item) => item.key,
    );

    expect(filterRosterReviewItems(reviewItems, 'focus').map((item) => item.rowKey)).toEqual([
      'endable',
    ]);
    expect(filterRosterReviewItems(reviewItems, 'local-decision')).toHaveLength(2);
  });
});
