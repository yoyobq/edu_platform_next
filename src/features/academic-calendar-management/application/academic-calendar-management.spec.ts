import { describe, expect, it } from 'vitest';

import {
  buildAcademicCalendarEventQueryInput,
  buildDefaultEventFormValues,
  buildDefaultSemesterFormValues,
  buildEventMutationRefreshPlan,
  createEmptyEventFilters,
  normalizeCalendarEventFormValues,
  normalizeSemesterFormValues,
  pickNextSemesterId,
  sortCalendarEvents,
  sortSemesters,
} from './academic-calendar-management';
import type { AcademicCalendarEventRecord, AcademicSemesterRecord } from './types';

function buildSemester(overrides: Partial<AcademicSemesterRecord>): AcademicSemesterRecord {
  return {
    createdAt: '2026-04-01T00:00:00.000Z',
    endDate: '2026-07-01',
    examStartDate: '2026-06-20',
    firstTeachingDate: '2026-02-23',
    id: 1,
    isCurrent: false,
    name: '2025-2026 第二学期',
    schoolYear: 2025,
    startDate: '2026-02-20',
    termNumber: 2,
    updatedAt: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

function buildEvent(overrides: Partial<AcademicCalendarEventRecord>): AcademicCalendarEventRecord {
  return {
    createdAt: '2026-04-01T00:00:00.000Z',
    dayPeriod: 'ALL_DAY',
    eventDate: '2026-04-20',
    eventType: 'ACTIVITY',
    id: 1,
    originalDate: null,
    recordStatus: 'ACTIVE',
    ruleNote: null,
    semesterId: 1,
    teachingCalcEffect: 'NO_CHANGE',
    topic: '默认事件',
    updatedAt: '2026-04-02T00:00:00.000Z',
    updatedByAccountId: 9527,
    version: 1,
    ...overrides,
  };
}

describe('academic-calendar-management application', () => {
  it('prioritizes current semester and newer terms when sorting semesters', () => {
    const sorted = sortSemesters([
      buildSemester({ id: 3, isCurrent: false, schoolYear: 2024, termNumber: 1 }),
      buildSemester({ id: 2, isCurrent: true, schoolYear: 2024, termNumber: 2 }),
      buildSemester({ id: 1, isCurrent: false, schoolYear: 2025, termNumber: 1 }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it('keeps event ordering stable by date then day period then id', () => {
    const sorted = sortCalendarEvents([
      buildEvent({ id: 3, dayPeriod: 'ALL_DAY', eventDate: '2026-04-22' }),
      buildEvent({ id: 2, dayPeriod: 'AFTERNOON', eventDate: '2026-04-21' }),
      buildEvent({ id: 1, dayPeriod: 'MORNING', eventDate: '2026-04-21' }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('normalizes query filters and form values before mutation', () => {
    expect(
      buildAcademicCalendarEventQueryInput(7, {
        eventDate: ' 2026-04-22 ',
        eventType: 'EXAM',
        recordStatus: 'ACTIVE',
      }),
    ).toEqual({
      eventDate: '2026-04-22',
      eventType: 'EXAM',
      limit: 500,
      recordStatus: 'ACTIVE',
      semesterId: 7,
    });

    expect(
      normalizeSemesterFormValues({
        endDate: '2026-07-10',
        examStartDate: '2026-06-20',
        firstTeachingDate: '2026-02-20',
        isCurrent: true,
        name: ' 2025-2026 学年第二学期 ',
        schoolYear: 2025,
        startDate: '2026-02-17',
        termNumber: 2,
      }),
    ).toEqual({
      endDate: '2026-07-10',
      examStartDate: '2026-06-20',
      firstTeachingDate: '2026-02-20',
      isCurrent: true,
      name: '2025-2026 学年第二学期',
      schoolYear: 2025,
      startDate: '2026-02-17',
      termNumber: 2,
    });

    expect(
      normalizeCalendarEventFormValues({
        dayPeriod: 'ALL_DAY',
        eventDate: '2026-05-01',
        eventType: 'HOLIDAY',
        originalDate: ' ',
        recordStatus: 'ACTIVE',
        ruleNote: '  五一放假  ',
        semesterId: 7,
        teachingCalcEffect: 'CANCEL',
        topic: ' 五一劳动节 ',
        version: 3,
      }),
    ).toEqual({
      dayPeriod: 'ALL_DAY',
      eventDate: '2026-05-01',
      eventType: 'HOLIDAY',
      originalDate: undefined,
      recordStatus: 'ACTIVE',
      ruleNote: '五一放假',
      semesterId: 7,
      teachingCalcEffect: 'CANCEL',
      topic: '五一劳动节',
      version: 3,
    });
  });

  it('keeps selection when possible and switches after cross-semester event edits', () => {
    expect(pickNextSemesterId([buildSemester({ id: 7 }), buildSemester({ id: 8 })], 8)).toBe(8);

    expect(buildEventMutationRefreshPlan(7, 8)).toEqual({
      nextSelectedSemesterId: 8,
      reloadSemesterId: null,
    });

    expect(buildEventMutationRefreshPlan(7, 7)).toEqual({
      nextSelectedSemesterId: 7,
      reloadSemesterId: 7,
    });
  });

  it('builds default empty form state for create flows', () => {
    expect(buildDefaultSemesterFormValues({ getFullYear: () => 2026 })).toEqual({
      endDate: '',
      examStartDate: '',
      firstTeachingDate: '',
      isCurrent: false,
      name: '',
      schoolYear: 2026,
      startDate: '',
      termNumber: 1,
    });

    expect(buildDefaultEventFormValues(9)).toEqual({
      dayPeriod: 'ALL_DAY',
      eventDate: '',
      eventType: 'ACTIVITY',
      originalDate: undefined,
      recordStatus: 'ACTIVE',
      ruleNote: undefined,
      semesterId: 9,
      teachingCalcEffect: 'NO_CHANGE',
      topic: '',
      version: 1,
    });

    expect(createEmptyEventFilters()).toEqual({
      eventDate: undefined,
      eventType: undefined,
      recordStatus: undefined,
    });
  });
});
