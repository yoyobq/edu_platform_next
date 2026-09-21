// src/features/academic-workload/ui/academic-workload-page-content.spec.ts

import { describe, expect, it } from 'vitest';

import {
  formatOccurrenceExclusionReason,
  resolveOccurrenceStatusLabel,
} from '../application/workload-trace';
import type { AcademicStableWorkloadOccurrence } from '../infrastructure/academic-workload-api';

function militaryOccurrence(
  calcEffect: AcademicStableWorkloadOccurrence['calcEffect'],
): AcademicStableWorkloadOccurrence {
  return {
    calcEffect,
    classroomName: null,
    coefficient: '1.00',
    courseCategory: null,
    courseName: '数学',
    date: '2026-09-08',
    exclusionEventId: 91,
    exclusionEventType: 'MILITARY_TRAINING',
    exclusionReason: 'MILITARY_TRAINING',
    exclusionTargetAdmissionCategory: 'HIGH_SCHOOL_ORIGIN',
    isEffective: false,
    logicalDayOfWeek: 2,
    periodEnd: 2,
    periodStart: 1,
    physicalDayOfWeek: 2,
    scheduleId: 'delivery:1',
    semesterId: 1,
    slotId: 'delivery:1',
    staffId: 'T-001',
    staffName: '王老师',
    sstsCourseId: 'C-001',
    sstsTeachingClassId: 'TC-001',
    teachingClassName: '高一 1 班',
    weekIndex: 1,
  };
}

describe('academic workload occurrence trace labels', () => {
  it.each(['NORMAL', 'MAKEUP', 'SWAP_IN', 'REPEAT'] as const)(
    'shows military exclusion without reclassifying %s',
    (calcEffect) => {
      const occurrence = militaryOccurrence(calcEffect);

      expect(resolveOccurrenceStatusLabel(occurrence)).toBe('军训不计入');
      expect(formatOccurrenceExclusionReason(occurrence)).toBe('军训 · 高中起点');
      expect(occurrence.calcEffect).toBe(calcEffect);
    },
  );
  it('shows all freshmen as the exclusion scope', () => {
    expect(
      formatOccurrenceExclusionReason({
        ...militaryOccurrence('NORMAL'),
        exclusionTargetAdmissionCategory: 'ALL_FRESHMEN',
      }),
    ).toBe('军训 · 全部新生');
  });
});
