// src/labs/academic-workload/application/workload-baseline.spec.ts
import { describe, expect, it } from 'vitest';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';

import {
  type AcademicWorkloadOccurrenceLike,
  buildAcademicWorkloadRangeSummary,
  buildTeachingWeekMonthMarkValues,
  buildTeachingWeekOptions,
  formatHours,
  pickNextSemesterId,
  resolveOccurrenceHourHundredths,
  sortSemesters,
} from './workload-baseline';

function buildSemester(patch: Partial<AcademicSemesterRecord>): AcademicSemesterRecord {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    endDate: '2026-07-10',
    examStartDate: '2026-06-29',
    firstTeachingDate: '2026-03-02',
    id: 1,
    isCurrent: false,
    name: '2025-2026-2',
    schoolYear: 2025,
    startDate: '2026-02-23',
    termNumber: 2,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

function buildOccurrence(
  patch: Partial<AcademicWorkloadOccurrenceLike>,
): AcademicWorkloadOccurrenceLike {
  return {
    calcEffect: 'NORMAL',
    coefficient: '1.00',
    courseName: '数学',
    date: '2026-03-09',
    isEffective: true,
    periodEnd: 2,
    periodStart: 1,
    teachingClassName: '高一 1 班',
    weekIndex: 2,
    ...patch,
  };
}

describe('academic workload baseline helpers', () => {
  it('sorts semesters with current semester first and keeps current selection when available', () => {
    const semesters = sortSemesters([
      buildSemester({ id: 1, isCurrent: false, schoolYear: 2024, termNumber: 2 }),
      buildSemester({ id: 2, isCurrent: true, schoolYear: 2025, termNumber: 1 }),
      buildSemester({ id: 3, isCurrent: false, schoolYear: 2025, termNumber: 2 }),
    ]);

    expect(semesters.map((semester) => semester.id)).toEqual([2, 3, 1]);
    expect(pickNextSemesterId(semesters, 3)).toBe(3);
    expect(pickNextSemesterId(semesters, 99)).toBe(2);
  });

  it('builds teaching week options from first teaching date to the week before exams', () => {
    const weeks = buildTeachingWeekOptions(
      buildSemester({
        examStartDate: '2026-03-30',
        firstTeachingDate: '2026-03-04',
      }),
    );

    expect(weeks).toEqual([
      { endDate: '2026-03-08', label: '第 1 周', startDate: '2026-03-02', value: 1 },
      { endDate: '2026-03-15', label: '第 2 周', startDate: '2026-03-09', value: 2 },
      { endDate: '2026-03-22', label: '第 3 周', startDate: '2026-03-16', value: 3 },
      { endDate: '2026-03-29', label: '第 4 周', startDate: '2026-03-23', value: 4 },
    ]);
  });

  it('marks the first teaching week and calendar month start weeks', () => {
    const weeks = buildTeachingWeekOptions(
      buildSemester({
        examStartDate: '2026-06-29',
        firstTeachingDate: '2026-03-04',
      }),
    );

    expect(buildTeachingWeekMonthMarkValues(weeks)).toEqual([1, 5, 9, 14]);
  });

  it('calculates occurrence hours in hundredths from period count and coefficient', () => {
    expect(
      resolveOccurrenceHourHundredths(
        buildOccurrence({ coefficient: '1.50', periodEnd: 7, periodStart: 5 }),
      ),
    ).toBe(450);
    expect(formatHours(450)).toBe('4.50');
    expect(formatHours(400)).toBe('4');
  });

  it('keeps baseline, deducted, added, and effective occurrence totals aligned', () => {
    const summary = buildAcademicWorkloadRangeSummary({
      effectiveRangeEnd: 8,
      effectiveRangeStart: 1,
      items: [
        buildOccurrence({ calcEffect: 'NORMAL', isEffective: true, weekIndex: 2 }),
        buildOccurrence({ calcEffect: 'CANCEL', isEffective: false, weekIndex: 3 }),
        buildOccurrence({ calcEffect: 'SWAP_OUT', isEffective: false, weekIndex: 4 }),
        buildOccurrence({ calcEffect: 'SWAP_IN', isEffective: true, weekIndex: 6 }),
        buildOccurrence({ calcEffect: 'MAKEUP', isEffective: true, weekIndex: 9 }),
      ],
      tableViewFilter: 'all',
    });

    expect(summary.displayedOccurrences.map((item) => item.weekIndex)).toEqual([2, 3, 4, 6]);
    expect(summary.baselineRangeHours).toBe(600);
    expect(summary.ineffectiveRangeHours).toBe(400);
    expect(summary.addedEffectiveRangeHours).toBe(200);
    expect(summary.effectiveRangeHours).toBe(400);
    expect(
      summary.baselineRangeHours - summary.ineffectiveRangeHours + summary.addedEffectiveRangeHours,
    ).toBe(summary.effectiveRangeHours);
  });
});
