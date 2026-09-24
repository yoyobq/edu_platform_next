// src/features/student-roster-membership-reconciliation/application/status-change-evidence.ts
import type { AcademicSemesterRecord } from '@/entities/academic-semester';

import type { ConfirmationDraft } from './confirmation-policy';
import type { StudentRosterMembershipReconciliationItem } from './types';

export const STATUS_CHANGE_LABELS: Record<string, string> = {
  '10': '退学',
  '20': '休学',
  '30': '留级',
  '40': '复学',
};
export function missingDecisionSemester(item: StudentRosterMembershipReconciliationItem) {
  return Boolean(
    item.activeDecisionId &&
    item.activeDecisionReasonCode !== 'NOT_CHECKED_IN_CONFIRMED' &&
    !item.activeDecisionEffectiveSemesterId,
  );
}
export function formatDecisionSemester(
  item: StudentRosterMembershipReconciliationItem,
  semesters: readonly AcademicSemesterRecord[],
) {
  if (!item.activeDecisionId) return '暂无裁定';
  if (item.activeDecisionReasonCode === 'NOT_CHECKED_IN_CONFIRMED') return '所有学期不纳入名单';
  if (!item.activeDecisionEffectiveSemesterId) return '缺少生效学期 · 历史名单仍可能保留';
  const semester = semesters.find((entry) => entry.id === item.activeDecisionEffectiveSemesterId);
  return semester
    ? `从 ${semester.schoolYear}—${semester.schoolYear + 1} 学年第 ${semester.termNumber} 学期起生效`
    : `生效学期 #${item.activeDecisionEffectiveSemesterId}（未加载）`;
}
export function suggestStatusChangeDecision(
  item: StudentRosterMembershipReconciliationItem,
  semesters: readonly AcademicSemesterRecord[],
): ConfirmationDraft | null {
  const evidence = item.statusChangeEvidence;
  if (!evidence?.complete || !evidence.events.length) return null;
  // A later suspension, restoration, unknown event or conflicting event prevents prefill.
  if (evidence.events.some((event) => !event.changeTime)) return null;
  const sorted = [...evidence.events].sort((a, b) =>
    (b.changeTime ?? '').localeCompare(a.changeTime ?? ''),
  );
  const event = sorted[0];
  if (
    sorted.filter((entry) => entry.changeTime === event.changeTime).length !== 1 ||
    event.classCode !== item.classCode
  )
    return null;
  const day = event.changeTime!.slice(0, 10);
  const matches = semesters.filter(
    (semester) =>
      semester.startDate &&
      semester.endDate &&
      semester.startDate <= day &&
      semester.endDate >= day,
  );
  if (matches.length !== 1) return null;
  const reasonCode =
    event.typeCode === '10'
      ? 'DROPPED_CONFIRMED'
      : event.typeCode === '30'
        ? 'RETAINED_GRADE_CONFIRMED'
        : event.typeCode === '40'
          ? 'REENROLLED_CONFIRMED'
          : null;
  if (!reasonCode) return null;
  // Inclusion requires the upstream roster to affirm the current class as well.
  if (
    event.typeCode !== '10' &&
    (item.upstreamPresence !== 'RETURNED' || item.upstreamClassCode !== item.classCode)
  )
    return null;
  return {
    decisionOutcome: event.typeCode === '10' ? 'EXCLUDE' : 'INCLUDE',
    reasonCode,
    effectiveSemesterId: matches[0].id,
    reasonText: `依据校园网${STATUS_CHANGE_LABELS[event.typeCode!]}记录（${event.changeTime}），人工复核。`,
  };
}
