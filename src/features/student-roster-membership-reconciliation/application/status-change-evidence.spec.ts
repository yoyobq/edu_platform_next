// src/features/student-roster-membership-reconciliation/application/status-change-evidence.spec.ts
import { describe, expect, it } from 'vitest';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';

import { missingDecisionSemester, suggestStatusChangeDecision } from './status-change-evidence';
import type { StudentRosterMembershipReconciliationItem } from './types';

const semesters = [
  { id: 1, schoolYear: 2024, termNumber: 1, startDate: '2024-09-01', endDate: '2025-01-20' },
] as AcademicSemesterRecord[];
const item = {
  classCode: '1032001',
  activeDecisionId: 'old',
  activeDecisionReasonCode: 'DROPPED_CONFIRMED',
  activeDecisionEffectiveSemesterId: null,
  statusChangeEvidence: {
    complete: true,
    state: 'HAS_EVENTS',
    events: [
      {
        logId: 'event',
        typeCode: '10',
        changeTime: '2024-09-27 14:51:22.000',
        classCode: '1032001',
      },
    ],
  },
} as StudentRosterMembershipReconciliationItem;

describe('status change evidence', () => {
  it('flags historical dropped decisions without a semester and suggests the persisted semester containing the dated event', () => {
    expect(missingDecisionSemester(item)).toBe(true);
    expect(suggestStatusChangeDecision(item, semesters)).toMatchObject({
      decisionOutcome: 'EXCLUDE',
      reasonCode: 'DROPPED_CONFIRMED',
      effectiveSemesterId: 1,
    });
  });
  it('never infers departure from an empty or partial snapshot', () => {
    expect(
      suggestStatusChangeDecision(
        { ...item, statusChangeEvidence: { ...item.statusChangeEvidence!, events: [] } },
        semesters,
      ),
    ).toBeNull();
    expect(
      suggestStatusChangeDecision(
        { ...item, statusChangeEvidence: { ...item.statusChangeEvidence!, complete: false } },
        semesters,
      ),
    ).toBeNull();
  });
  it('rejects dates in calendar gaps and overlapping persisted semesters', () => {
    expect(suggestStatusChangeDecision(item, [])).toBeNull();
    expect(
      suggestStatusChangeDecision(item, [...semesters, { ...semesters[0], id: 2 }]),
    ).toBeNull();
  });
  it('does not prefill unknown, missing-date, cross-class or later reinstatement evidence', () => {
    for (const patch of [
      { typeCode: '99' },
      { changeTime: null },
      { classCode: 'other' },
      { typeCode: '40' },
    ]) {
      expect(
        suggestStatusChangeDecision(
          {
            ...item,
            statusChangeEvidence: {
              ...item.statusChangeEvidence!,
              events: [{ ...item.statusChangeEvidence!.events[0], ...patch }],
            },
          },
          semesters,
        ),
      ).toBeNull();
    }
  });
  it('does not require a semester for confirmed never-reported students', () => {
    expect(
      missingDecisionSemester({ ...item, activeDecisionReasonCode: 'NOT_CHECKED_IN_CONFIRMED' }),
    ).toBe(false);
  });
});
