// src/features/student-roster-membership-reconciliation/application/commit-work.spec.ts

import { describe, expect, it } from 'vitest';

import { hasAutomaticRosterCommitWork } from './commit-work';
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

describe('commit work policy', () => {
  it('treats no-change automatic items as no backend commit work', () => {
    expect(
      hasAutomaticRosterCommitWork([
        buildItem({
          action: 'NO_CHANGE',
          category: 'AUTO_APPLY',
        }),
        buildItem({
          action: 'SUPPRESSED_BY_EXCLUDE_DECISION',
          category: 'SUPPRESSED',
        }),
      ]),
    ).toBe(false);
  });

  it('treats automatic membership actions as backend commit work', () => {
    expect(
      hasAutomaticRosterCommitWork([
        buildItem({
          action: 'ENSURE_MEMBERSHIP',
          category: 'AUTO_APPLY',
        }),
      ]),
    ).toBe(true);
  });
});
