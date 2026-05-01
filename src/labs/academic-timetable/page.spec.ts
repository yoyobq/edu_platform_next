import { describe, expect, it } from 'vitest';

import {
  buildTimetableSlotPlacements,
  resolveCourseCategoryMeta,
  resolveCurrentTeachingWeekIndex,
  resolveTimetablePeriodCount,
} from './helpers';

describe('academic-timetable page helpers', () => {
  it('maps course category enums and passthrough values to the shared Chinese labels', () => {
    expect(resolveCourseCategoryMeta('THEORY')).toEqual(
      expect.objectContaining({
        accentClassName: 'academic-timetable-course-category-theory',
        label: '理论课',
        surfaceClassName: 'academic-timetable-course-surface-theory',
      }),
    );
    expect(resolveCourseCategoryMeta('2')).toEqual(
      expect.objectContaining({
        accentClassName: 'academic-timetable-course-category-practice',
        label: '实践课',
        surfaceClassName: 'academic-timetable-course-surface-practice',
      }),
    );
    expect(resolveCourseCategoryMeta('一体化')).toEqual(
      expect.objectContaining({
        accentClassName: 'academic-timetable-course-category-integrated',
        label: '一体化',
        surfaceClassName: 'academic-timetable-course-surface-integrated',
      }),
    );
    expect(resolveCourseCategoryMeta('OTHER')).toBeNull();
  });

  it('keeps the full period span for the reported weekly sample data', () => {
    const placements = buildTimetableSlotPlacements(
      [
        { dayOfWeek: 1, periodEnd: 2, periodStart: 1, slotId: 'mon-1-2' },
        { dayOfWeek: 1, periodEnd: 8, periodStart: 5, slotId: 'mon-5-8' },
        { dayOfWeek: 3, periodEnd: 2, periodStart: 1, slotId: 'wed-1-2' },
        { dayOfWeek: 3, periodEnd: 7, periodStart: 5, slotId: 'wed-5-7' },
        { dayOfWeek: 2, periodEnd: 8, periodStart: 3, slotId: 'tue-3-8' },
        { dayOfWeek: 4, periodEnd: 7, periodStart: 5, slotId: 'thu-5-7' },
      ],
      (item) => String(item.slotId),
    );

    expect(placements).toEqual([
      expect.objectContaining({
        dayOfWeek: 1,
        laneCount: 1,
        laneIndex: 0,
        periodEnd: 2,
        periodStart: 1,
      }),
      expect.objectContaining({
        dayOfWeek: 1,
        laneCount: 1,
        laneIndex: 0,
        periodEnd: 8,
        periodStart: 5,
      }),
      expect.objectContaining({
        dayOfWeek: 2,
        laneCount: 1,
        laneIndex: 0,
        periodEnd: 8,
        periodStart: 3,
      }),
      expect.objectContaining({
        dayOfWeek: 3,
        laneCount: 1,
        laneIndex: 0,
        periodEnd: 2,
        periodStart: 1,
      }),
      expect.objectContaining({
        dayOfWeek: 3,
        laneCount: 1,
        laneIndex: 0,
        periodEnd: 7,
        periodStart: 5,
      }),
      expect.objectContaining({
        dayOfWeek: 4,
        laneCount: 1,
        laneIndex: 0,
        periodEnd: 7,
        periodStart: 5,
      }),
    ]);
  });

  it('splits partially overlapping ranges into parallel lanes', () => {
    const placements = buildTimetableSlotPlacements(
      [
        { dayOfWeek: 1, periodEnd: 7, periodStart: 3, slotId: 'a' },
        { dayOfWeek: 1, periodEnd: 6, periodStart: 5, slotId: 'b' },
        { dayOfWeek: 1, periodEnd: 10, periodStart: 8, slotId: 'c' },
      ],
      (item) => String(item.slotId),
    );

    expect(placements).toEqual([
      expect.objectContaining({ laneCount: 2, laneIndex: 0, periodEnd: 7, periodStart: 3 }),
      expect.objectContaining({ laneCount: 2, laneIndex: 1, periodEnd: 6, periodStart: 5 }),
      expect.objectContaining({ laneCount: 1, laneIndex: 0, periodEnd: 10, periodStart: 8 }),
    ]);
  });

  it('keeps identical ranges stacked inside the same lane group', () => {
    const placements = buildTimetableSlotPlacements(
      [
        { dayOfWeek: 2, periodEnd: 4, periodStart: 3, slotId: 'a' },
        { dayOfWeek: 2, periodEnd: 4, periodStart: 3, slotId: 'b' },
      ],
      (item) => String(item.slotId),
    );

    expect(placements).toHaveLength(1);
    expect(placements[0]).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ slotId: 'a' }), expect.objectContaining({ slotId: 'b' })],
        laneCount: 1,
        laneIndex: 0,
        periodEnd: 4,
        periodStart: 3,
      }),
    );
  });

  it('scales visible periods to the latest occupied period while capping at 12', () => {
    expect(
      resolveTimetablePeriodCount([
        { dayOfWeek: 1, periodEnd: 2, periodStart: 1, slotId: 'a' },
        { dayOfWeek: 3, periodEnd: 7, periodStart: 5, slotId: 'b' },
      ]),
    ).toBe(7);

    expect(
      resolveTimetablePeriodCount([
        { dayOfWeek: 1, periodEnd: 13, periodStart: 11, slotId: 'late' },
      ]),
    ).toBe(12);
  });

  it('resolves the current teaching week from the selected semester calendar', () => {
    const semester = {
      endDate: '2026-07-17',
      firstTeachingDate: '2026-03-02',
      startDate: '2026-02-23',
    };

    expect(
      resolveCurrentTeachingWeekIndex(semester, {
        today: new Date(2026, 2, 2),
      }),
    ).toBe(1);
    expect(
      resolveCurrentTeachingWeekIndex(semester, {
        today: new Date(2026, 2, 11),
      }),
    ).toBe(2);
    expect(
      resolveCurrentTeachingWeekIndex(semester, {
        today: new Date(2026, 1, 25),
      }),
    ).toBe(1);
  });

  it('does not resolve a teaching week outside the selected semester range', () => {
    const semester = {
      endDate: '2026-07-17',
      firstTeachingDate: '2026-03-02',
      startDate: '2026-02-23',
    };

    expect(
      resolveCurrentTeachingWeekIndex(semester, {
        today: new Date(2026, 1, 22),
      }),
    ).toBeNull();
    expect(
      resolveCurrentTeachingWeekIndex(semester, {
        today: new Date(2026, 6, 18),
      }),
    ).toBeNull();
  });
});
