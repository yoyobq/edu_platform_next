import { describe, expect, it } from 'vitest';

import type { TeachingPlanOccurrence } from '../types';

import {
  buildTeachingPlanProjection,
  formatTeachingPlanBusinessDate,
  resolveCourseCategoryPresentation,
} from './teaching-plan-projection';

describe('teaching plan projection', () => {
  it('按 scheduleId 分组并保持同名不同教学班独立', () => {
    const projection = buildTeachingPlanProjection([
      occurrence({ scheduleId: 2, teachingClassName: '二班' }),
      occurrence({ scheduleId: 1, teachingClassName: '一班' }),
    ]);

    expect(projection.courses).toHaveLength(2);
    expect(projection.courses.map((course) => course.scheduleId).sort()).toEqual([1, 2]);
    expect(projection.courses[0]?.classroomName).toBe('教一 101');
  });

  it('只把有效 occurrence 放入主日期线并把停课调出旁列', () => {
    const projection = buildTeachingPlanProjection([
      occurrence({ date: '2026-09-08', calcEffect: 'MAKEUP', isEffective: true }),
      occurrence({ date: '2026-09-01', calcEffect: 'NORMAL', isEffective: true }),
      occurrence({ date: '2026-09-02', calcEffect: 'CANCEL', isEffective: false }),
      occurrence({ date: '2026-09-03', calcEffect: 'SWAP_OUT', isEffective: false }),
    ]);
    const course = projection.courses[0];

    expect(course?.months[0]?.dates.map((group) => group.date)).toEqual([
      '2026-09-01',
      '2026-09-08',
    ]);
    expect(course?.adjustmentOccurrences.map((item) => item.calcEffect)).toEqual([
      'CANCEL',
      'SWAP_OUT',
    ]);
    expect(projection).toMatchObject({
      adjustmentOccurrenceCount: 2,
      dateCount: 2,
      effectiveOccurrenceCount: 2,
    });
  });

  it('按 business date 字符串排序且不做时区换算', () => {
    expect(formatTeachingPlanBusinessDate('2026-09-07')).toBe('9月7日');
    expect(formatTeachingPlanBusinessDate('invalid')).toBe('invalid');
  });

  it.each([
    ['THEORY', 'theory', '理论课'],
    ['2', 'practice', '实践课'],
    ['一体化', 'integrated', '一体化'],
    ['UNKNOWN', 'neutral', 'UNKNOWN'],
  ])('映射课程类别 %s', (value, kind, label) => {
    expect(resolveCourseCategoryPresentation(value)).toEqual({ kind, label });
  });
});

function occurrence(overrides: Partial<TeachingPlanOccurrence> = {}): TeachingPlanOccurrence {
  return {
    calcEffect: 'NORMAL',
    classroomName: '教一 101',
    coefficient: '1.00',
    courseCategory: 'THEORY',
    courseName: '高等数学',
    date: '2026-09-01',
    isEffective: true,
    logicalDayOfWeek: 2,
    periodEnd: 2,
    periodStart: 1,
    physicalDayOfWeek: 2,
    scheduleId: 1,
    semesterId: 8,
    slotId: 10,
    staffId: 'T001',
    staffName: '张老师',
    teachingClassName: '一班',
    weekIndex: 1,
    ...overrides,
  };
}
