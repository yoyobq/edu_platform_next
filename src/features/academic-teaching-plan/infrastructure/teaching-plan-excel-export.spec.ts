// src/features/academic-teaching-plan/infrastructure/teaching-plan-excel-export.spec.ts

import { describe, expect, it } from 'vitest';

import { buildTeachingPlanProjection } from '../application/teaching-plan-projection';
import {
  buildTeachingPlanFormalRows,
  createEmptyTeachingPlanCourseDraft,
} from '../application/teaching-plan-sheet';
import type { TeachingPlanOccurrence } from '../types';

import {
  buildTeachingPlanExcelFileName,
  buildTeachingPlanExcelRows,
  buildTeachingPlanXlsBuffer,
} from './teaching-plan-excel-export';

describe('teaching plan excel export', () => {
  it('按真源片段逐行导出 A-G，不把双节片段合并', () => {
    const projection = buildTeachingPlanProjection([
      occurrence({ slotId: 11, periodStart: 1, periodEnd: 2 }),
      occurrence({ slotId: 12, periodStart: 3, periodEnd: 4 }),
    ]);
    const draft = createEmptyTeachingPlanCourseDraft(2);
    const formalRows = buildTeachingPlanFormalRows(projection.courses[0]!, draft);

    expect(buildTeachingPlanExcelRows({ contentRows: draft.contentRows, formalRows })).toEqual([
      ['2026-03-02', 2, '1,2', '线下', '', '', ''],
      ['2026-03-02', 2, '3,4', '线下', '', '', ''],
    ]);
  });

  it('生成可直接下载的安全 xls 文件名', () => {
    expect(
      buildTeachingPlanExcelFileName({
        courseName: '网页设计/制作',
        teachingClassName: '信息 2301 班',
      }),
    ).toBe('信息 2301 班-网页设计 制作-授课计划.xls');
  });

  it('生成真实的 OLE/BIFF xls，而不是只修改文件后缀', async () => {
    const course = buildTeachingPlanProjection([occurrence({})]).courses[0]!;
    const draft = createEmptyTeachingPlanCourseDraft(1);
    const formalRows = buildTeachingPlanFormalRows(course, draft);
    const buffer = await buildTeachingPlanXlsBuffer({
      contentRows: draft.contentRows,
      courseName: course.courseName,
      formalRows,
      teachingClassName: course.teachingClassName,
    });

    expect(Array.from(new Uint8Array(buffer, 0, 8))).toEqual([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
  });

  it('导出时应使用后端统一地点', () => {
    const course = buildTeachingPlanProjection([occurrence({ classroomName: '知行楼 302' })])
      .courses[0]!;
    const draft = createEmptyTeachingPlanCourseDraft(1);
    const formalRows = buildTeachingPlanFormalRows(course, draft);

    expect(buildTeachingPlanExcelRows({ contentRows: draft.contentRows, formalRows })[0]?.[4]).toBe(
      '知行楼 302',
    );
  });

  it('内容组数量与正式课次数不一致时拒绝生成 Excel 行', () => {
    const course = buildTeachingPlanProjection([occurrence({})]).courses[0]!;
    const formalRows = buildTeachingPlanFormalRows(course, createEmptyTeachingPlanCourseDraft());

    expect(() => buildTeachingPlanExcelRows({ contentRows: [], formalRows })).toThrow(
      '授课计划内容行数（0）必须与正式课次数（1）一致',
    );
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
