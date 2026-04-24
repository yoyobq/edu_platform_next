import { describe, expect, it } from 'vitest';

import {
  buildEventBuckets,
  buildSemesterWeeks,
  buildWeekMonthSpans,
  countTeachingWeeks,
  createLatestRequestSequence,
  formatDisplayDate,
  resolveEventDisplayTopic,
} from './semester-calendar';
import type { AcademicCalendarEventRecord, AcademicSemesterRecord } from './types';

function buildSemester(overrides: Partial<AcademicSemesterRecord>): AcademicSemesterRecord {
  return {
    createdAt: '2026-04-01T00:00:00.000Z',
    endDate: '2026-07-10',
    examStartDate: '2026-06-22',
    firstTeachingDate: '2026-02-20',
    id: 101,
    isCurrent: true,
    name: '2025-2026 学年第二学期',
    schoolYear: 2025,
    startDate: '2026-02-17',
    termNumber: 2,
    updatedAt: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

function buildEvent(overrides: Partial<AcademicCalendarEventRecord>): AcademicCalendarEventRecord {
  return {
    createdAt: '2026-04-05T00:00:00.000Z',
    dayPeriod: 'ALL_DAY',
    eventDate: '2026-04-20',
    eventType: 'SPORTS_MEET',
    id: 201,
    originalDate: null,
    recordStatus: 'ACTIVE',
    ruleNote: '春季活动安排',
    semesterId: 101,
    teachingCalcEffect: 'NO_CHANGE',
    topic: '春季运动会',
    updatedAt: '2026-04-06T00:00:00.000Z',
    updatedByAccountId: 9527,
    version: 1,
    ...overrides,
  };
}

describe('semester-calendar application', () => {
  it('builds weeks from semester boundary weeks and teaching week numbers', () => {
    const weeks = buildSemesterWeeks(
      buildSemester({
        firstTeachingDate: '2026-02-24',
      }),
      {
        today: new Date('2026-04-20T08:00:00.000Z'),
      },
    );

    expect(weeks).toHaveLength(21);
    expect(weeks[0]?.startDate).toBe('2026-02-16');
    expect(weeks[0]?.weekNumber).toBeNull();
    expect(weeks[1]?.weekNumber).toBe(1);
    expect(weeks[9]?.hasToday).toBe(true);
    expect(weeks[18]?.days.some((day) => day.isExamStart)).toBe(true);
    expect(weeks.at(-1)?.endDate).toBe('2026-07-12');
    expect(countTeachingWeeks(weeks)).toBe(20);
  });

  it('groups weeks by display month and buckets events by date', () => {
    const weeks = buildSemesterWeeks(buildSemester({}), {
      today: new Date('2026-04-20T08:00:00.000Z'),
    });
    const monthSpans = buildWeekMonthSpans(weeks);
    const buckets = buildEventBuckets([
      buildEvent({ id: 201, eventDate: '2026-04-20' }),
      buildEvent({ id: 202, eventDate: '2026-04-20', topic: '第二个事件' }),
      buildEvent({ id: 203, eventDate: '2026-04-25', topic: '假期预告' }),
    ]);

    expect(monthSpans.map((item) => `${item.label}:${item.span}`)).toEqual([
      '2月:2',
      '3月:5',
      '4月:4',
      '5月:4',
      '6月:5',
      '7月:1',
    ]);
    expect(buckets.get('2026-04-20')?.map((event) => event.id)).toEqual([201, 202]);
    expect(buckets.get('2026-04-25')?.map((event) => event.id)).toEqual([203]);
  });

  it('formats adjusted teaching events for display', () => {
    expect(
      resolveEventDisplayTopic(
        buildEvent({
          eventType: 'HOLIDAY_MAKEUP',
          originalDate: '2026-05-01',
          teachingCalcEffect: 'MAKEUP',
          topic: '五一补课',
        }),
      ),
    ).toBe('调 05-01 课(周五)');

    expect(formatDisplayDate('2026-04-20')).toContain('4月20日');
    expect(resolveEventDisplayTopic(buildEvent({ topic: '春季运动会' }))).toBe('春季运动会');
  });

  it('tracks only the latest event request as writable', () => {
    const requestSequence = createLatestRequestSequence();
    const appliedResults: number[] = [];
    const first = requestSequence.begin();
    const second = requestSequence.begin();

    if (requestSequence.isLatest(second)) {
      appliedResults.push(102);
    }

    if (requestSequence.isLatest(first)) {
      appliedResults.push(101);
    }

    requestSequence.invalidate();

    expect(appliedResults).toEqual([102]);
    expect(requestSequence.isLatest(first)).toBe(false);
    expect(requestSequence.isLatest(second)).toBe(false);
  });
});
