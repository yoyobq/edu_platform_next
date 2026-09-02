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
  it('包含全部潜在扣课日期并与实际扣课日期合并去重排序', () => {
    const result = buildAcademicWorkloadDeductionDateColumns({
      calendarEvents: [
        buildEvent(),
        buildEvent({
          eventDate: '2026-04-11',
          originalDate: '2026-04-10',
          teachingCalcEffect: 'SWAP',
        }),
        buildEvent({ eventDate: '2026-04-12', teachingCalcEffect: 'MAKEUP' }),
        buildEvent({ eventDate: '2026-04-20', teachingCalcEffect: 'NO_CHANGE' }),
        buildEvent(),
      ],
      deductionDates: ['2026-03-16', '2026-04-06'],
      showSportsMeetDeductions: true,
    });

    expect(result).toEqual(['2026-03-16', '2026-04-06', '2026-04-10']);
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
    ).toEqual(['2026-04-21']);
    expect(
      buildAcademicWorkloadDeductionDateColumns({
        calendarEvents,
        deductionDates: [],
        showSportsMeetDeductions: true,
      }),
    ).toEqual(['2026-04-20', '2026-04-21']);
  });
});
