// src/features/academic-workload/application/workload-deduction-special-dates.spec.ts

import { describe, expect, it } from 'vitest';

import {
  type AcademicWorkloadDeductionCalendarEventLike,
  buildAcademicWorkloadDeductionDateColumns,
} from './workload-deduction-special-dates';

function buildEvent(
  overrides: Partial<AcademicWorkloadDeductionCalendarEventLike> = {},
): AcademicWorkloadDeductionCalendarEventLike {
  return {
    eventDate: '2026-04-06',
    eventType: 'HOLIDAY',
    originalDate: null,
    teachingCalcEffect: 'CANCEL',
    ...overrides,
  };
}

describe('buildAcademicWorkloadDeductionDateColumns', () => {
  it('合并未抵消扣课日期与重复教学日期并去重排序', () => {
    const result = buildAcademicWorkloadDeductionDateColumns({
      calendarEvents: [
        buildEvent(),
        buildEvent({
          eventDate: '2026-04-11',
          originalDate: '2026-04-10',
          teachingCalcEffect: 'SWAP',
        }),
        buildEvent({ eventDate: '2026-04-12', teachingCalcEffect: 'MAKEUP' }),
        buildEvent({
          eventDate: '2026-04-13',
          eventType: 'REPEATED_TEACHING_DAY',
          originalDate: '2026-04-14',
          teachingCalcEffect: 'REPEAT',
        }),
        buildEvent({ eventDate: '2026-04-20', teachingCalcEffect: 'NO_CHANGE' }),
        buildEvent(),
      ],
      deductionDates: ['2026-03-16', '2026-04-06'],
      showSportsMeetDeductions: true,
    });

    expect(result).toEqual([
      { date: '2026-03-16', isRepeatedTeachingDate: false },
      { date: '2026-04-06', isRepeatedTeachingDate: false },
      { date: '2026-04-13', isRepeatedTeachingDate: true },
    ]);
  });

  it('关闭运动会扣课时仅移除运动会独占日期', () => {
    const calendarEvents = [
      buildEvent({ eventDate: '2026-04-20', eventType: 'SPORTS_MEET' }),
      buildEvent({ eventDate: '2026-04-21', eventType: 'SPORTS_MEET' }),
      buildEvent({ eventDate: '2026-04-21', eventType: 'ACTIVITY' }),
    ];

    expect(
      buildAcademicWorkloadDeductionDateColumns({
        calendarEvents,
        deductionDates: [],
        showSportsMeetDeductions: false,
      }),
    ).toEqual([{ date: '2026-04-21', isRepeatedTeachingDate: false }]);
    expect(
      buildAcademicWorkloadDeductionDateColumns({
        calendarEvents,
        deductionDates: [],
        showSportsMeetDeductions: true,
      }),
    ).toEqual([
      { date: '2026-04-20', isRepeatedTeachingDate: false },
      { date: '2026-04-21', isRepeatedTeachingDate: false },
    ]);
  });

  it('补课或调课完全抵消时不保留原停课日期，有剩余扣课时仍显示', () => {
    const calendarEvents = [
      buildEvent({ eventDate: '2026-04-06' }),
      buildEvent({
        eventDate: '2026-04-25',
        eventType: 'HOLIDAY_MAKEUP',
        originalDate: '2026-04-06',
        teachingCalcEffect: 'MAKEUP',
      }),
      buildEvent({
        eventDate: '2026-05-09',
        eventType: 'WEEKDAY_SWAP',
        originalDate: '2026-05-04',
        teachingCalcEffect: 'SWAP',
      }),
    ];

    expect(
      buildAcademicWorkloadDeductionDateColumns({
        calendarEvents,
        deductionDates: [],
        showSportsMeetDeductions: true,
      }),
    ).toEqual([]);
    expect(
      buildAcademicWorkloadDeductionDateColumns({
        calendarEvents,
        deductionDates: ['2026-04-06', '2026-05-04'],
        showSportsMeetDeductions: true,
      }),
    ).toEqual([
      { date: '2026-04-06', isRepeatedTeachingDate: false },
      { date: '2026-05-04', isRepeatedTeachingDate: false },
    ]);
  });
});
