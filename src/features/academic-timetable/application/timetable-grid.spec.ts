// src/features/academic-timetable/application/timetable-grid.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildAcademicTeachingClassOptionLabel,
  resolveCurrentTeachingWeekIndex,
  resolveTeachingWeekCount,
  resolveTeachingWeekDateRange,
} from './timetable-grid';

const semester = {
  endDate: '2026-07-10',
  examStartDate: '2026-06-29',
  firstTeachingDate: '2026-03-02',
  startDate: '2026-02-23',
};

describe('academic timetable grid helpers', () => {
  it('builds teaching class option labels with empty array fallbacks', () => {
    expect(
      buildAcademicTeachingClassOptionLabel({
        courseNames: ['语文', '数学'],
        sstsTeachingClassId: 'TC-001',
        staffNames: ['张三', '李四'],
        teachingClassNames: ['高一 1 班'],
      }),
    ).toBe('语文/数学 / 高一 1 班 (TC-001) - 张三/李四');

    expect(
      buildAcademicTeachingClassOptionLabel({
        courseNames: [],
        sstsTeachingClassId: 'TC-002',
        staffNames: [],
        teachingClassNames: [],
      }),
    ).toBe('未命名课程 / 未命名教学班 (TC-002)');
  });

  it('resolves current teaching week, count, and range from semester dates', () => {
    expect(resolveCurrentTeachingWeekIndex(semester, { today: new Date('2026-03-09') })).toBe(2);
    expect(resolveTeachingWeekCount(semester)).toBe(17);
    expect(resolveTeachingWeekDateRange(semester, 2)).toEqual({
      endDate: '2026-03-15',
      startDate: '2026-03-09',
    });
  });
});
