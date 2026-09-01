import { describe, expect, it } from 'vitest';

import type { TeachingPlanOccurrence } from '../types';

import { buildTeachingPlanProjection } from './teaching-plan-projection';
import {
  buildTeachingPlanSheetRows,
  createEmptyTeachingPlanCourseDraft,
  fillEmptyTeachingPlanLocations,
  updateTeachingPlanRowDraft,
} from './teaching-plan-sheet';

describe('teaching plan sheet', () => {
  it('严格按真源 occurrence 片段生成行，不把同日 1-2 与 3-4 合并', () => {
    const projection = buildTeachingPlanProjection([
      occurrence({ slotId: 11, periodStart: 1, periodEnd: 2 }),
      occurrence({ slotId: 12, periodStart: 3, periodEnd: 4 }),
    ]);
    const rows = buildTeachingPlanSheetRows(
      projection.courses[0]!,
      createEmptyTeachingPlanCourseDraft(),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.teachingHours, row.periodsText])).toEqual([
      [2, '1,2'],
      [2, '3,4'],
    ]);
  });

  it('授课方式默认线下且保留未来 Excel F/G 空列模型', () => {
    const course = buildTeachingPlanProjection([occurrence()]).courses[0]!;
    const [row] = buildTeachingPlanSheetRows(course, createEmptyTeachingPlanCourseDraft());

    expect(row).toMatchObject({
      chapterAndContent: '',
      deliveryMode: 'OFFLINE',
      homework: '',
      location: '',
    });
  });

  it('首次地点只填充空行，不覆盖已有地点', () => {
    const base = updateTeachingPlanRowDraft({
      draft: createEmptyTeachingPlanCourseDraft(),
      rowKey: 'row-2',
      patch: { location: '实训楼 201' },
    });
    const result = fillEmptyTeachingPlanLocations({
      draft: base,
      location: '机房 5102',
      markInitialApplied: true,
      rowKeys: ['row-1', 'row-2', 'row-3'],
    });

    expect(result.filledCount).toBe(2);
    expect(result.draft.initialLocationApplied).toBe(true);
    expect(result.draft.rows).toMatchObject({
      'row-1': { location: '机房 5102' },
      'row-2': { location: '实训楼 201' },
      'row-3': { location: '机房 5102' },
    });
  });
});

function occurrence(overrides: Partial<TeachingPlanOccurrence> = {}): TeachingPlanOccurrence {
  return {
    calcEffect: 'NORMAL',
    classroomName: '课表教室',
    coefficient: '1.00',
    courseCategory: 'THEORY',
    courseName: '网页设计与制作',
    date: '2026-03-02',
    isEffective: true,
    logicalDayOfWeek: 1,
    periodEnd: 2,
    periodStart: 1,
    physicalDayOfWeek: 1,
    scheduleId: 1,
    semesterId: 8,
    slotId: 10,
    staffId: 'T001',
    staffName: '张老师',
    teachingClassName: '信息 2301 班',
    weekIndex: 1,
    ...overrides,
  };
}
