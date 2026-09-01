import { describe, expect, it } from 'vitest';

import { buildTeachingPlanProjection } from '../application/teaching-plan-projection';
import {
  buildTeachingPlanSheetRows,
  createEmptyTeachingPlanCourseDraft,
} from '../application/teaching-plan-sheet';
import type { TeachingPlanOccurrence } from '../types';

import {
  buildTeachingPlanExcelFileName,
  buildTeachingPlanExcelRows,
} from './teaching-plan-excel-export';

describe('teaching plan excel export', () => {
  it('按真源片段逐行导出 A-G，不把双节片段合并', () => {
    const projection = buildTeachingPlanProjection([
      occurrence({ slotId: 11, periodStart: 1, periodEnd: 2 }),
      occurrence({ slotId: 12, periodStart: 3, periodEnd: 4 }),
    ]);
    const rows = buildTeachingPlanSheetRows(
      projection.courses[0]!,
      createEmptyTeachingPlanCourseDraft(),
    );

    expect(buildTeachingPlanExcelRows(rows)).toEqual([
      ['2026-03-02', 2, '1,2', '线下', '', '', ''],
      ['2026-03-02', 2, '3,4', '线下', '', '', ''],
    ]);
  });

  it('生成可直接下载的安全 xlsx 文件名', () => {
    expect(
      buildTeachingPlanExcelFileName({
        courseName: '网页设计/制作',
        teachingClassName: '信息 2301 班',
      }),
    ).toBe('信息 2301 班-网页设计 制作-教学计划.xlsx');
  });
});

function occurrence(overrides: Partial<TeachingPlanOccurrence>): TeachingPlanOccurrence {
  return {
    calcEffect: 'NORMAL',
    classroomName: null,
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
