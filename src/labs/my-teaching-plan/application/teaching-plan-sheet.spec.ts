import { describe, expect, it } from 'vitest';

import type { TeachingPlanOccurrence } from '../types';

import { buildTeachingPlanProjection } from './teaching-plan-projection';
import {
  buildTeachingPlanSheetRows,
  clearTeachingPlanLocationOverrides,
  createEmptyTeachingPlanCourseDraft,
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
    const course = buildTeachingPlanProjection([occurrence({ classroomName: null })]).courses[0]!;
    const [row] = buildTeachingPlanSheetRows(course, createEmptyTeachingPlanCourseDraft());

    expect(row).toMatchObject({
      chapterAndContent: '',
      deliveryMode: 'OFFLINE',
      homework: '',
      location: '',
    });
  });

  it('后端统一地点应作为默认值，修改授课方式不应把它覆盖为空', () => {
    const course = buildTeachingPlanProjection([occurrence()]).courses[0]!;
    const draft = updateTeachingPlanRowDraft({
      draft: createEmptyTeachingPlanCourseDraft(),
      rowKey: '2026-03-02:10:NORMAL',
      patch: { deliveryMode: 'ONLINE' },
    });
    const [row] = buildTeachingPlanSheetRows(course, draft);

    expect(row).toMatchObject({ deliveryMode: 'ONLINE', location: '课表教室' });
  });

  it('逐行地点覆盖后端默认值，整体修改时可一次清除全部覆盖', () => {
    const course = buildTeachingPlanProjection([occurrence()]).courses[0]!;
    const draft = updateTeachingPlanRowDraft({
      draft: createEmptyTeachingPlanCourseDraft(),
      rowKey: '2026-03-02:10:NORMAL',
      patch: { locationOverride: '实训楼 201' },
    });

    expect(buildTeachingPlanSheetRows(course, draft)[0]?.location).toBe('实训楼 201');
    expect(
      buildTeachingPlanSheetRows(course, clearTeachingPlanLocationOverrides(draft))[0]?.location,
    ).toBe('课表教室');
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
