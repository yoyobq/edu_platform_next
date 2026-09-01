// src/features/academic-teaching-plan/application/teaching-plan-sheet.spec.ts

import { describe, expect, it } from 'vitest';

import type { TeachingPlanOccurrence } from '../types';

import { buildTeachingPlanProjection } from './teaching-plan-projection';
import {
  buildTeachingPlanDisplayRows,
  buildTeachingPlanFormalRows,
  clearTeachingPlanLocationOverrides,
  createEmptyTeachingPlanCourseDraft,
  deleteTeachingPlanContentRow,
  moveTeachingPlanContentRow,
  moveTeachingPlanContentRowToEmptySlot,
  updateTeachingPlanContentRow,
  updateTeachingPlanRowDraft,
} from './teaching-plan-sheet';

describe('teaching plan sheet', () => {
  it('严格按真源 occurrence 片段生成行，不把同日 1-2 与 3-4 合并', () => {
    const projection = buildTeachingPlanProjection([
      occurrence({ slotId: 11, periodStart: 1, periodEnd: 2 }),
      occurrence({ slotId: 12, periodStart: 3, periodEnd: 4 }),
    ]);
    const rows = buildTeachingPlanFormalRows(
      projection.courses[0]!,
      createEmptyTeachingPlanCourseDraft(),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.teachingHours, row.periodsText])).toEqual([
      [2, '1,2'],
      [2, '3,4'],
    ]);
  });

  it('正式课次和 F/G 内容组独立投影，内容更多时 A-E 保持空白', () => {
    const course = buildTeachingPlanProjection([occurrence({ classroomName: null })]).courses[0]!;
    const draft = createEmptyTeachingPlanCourseDraft(2);
    const formalRows = buildTeachingPlanFormalRows(course, draft);
    const rows = buildTeachingPlanDisplayRows({ contentRows: draft.contentRows, formalRows });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.formalRow).toMatchObject({ deliveryMode: 'OFFLINE', location: '' });
    expect(rows[0]?.contentRow).toMatchObject({ chapterAndContent: '', homework: '' });
    expect(rows[1]?.formalRow).toBeNull();
    expect(rows[1]?.contentRow).not.toBeNull();
  });

  it('后端统一地点应作为默认值，修改授课方式不应把它覆盖为空', () => {
    const course = buildTeachingPlanProjection([occurrence()]).courses[0]!;
    const draft = updateTeachingPlanRowDraft({
      draft: createEmptyTeachingPlanCourseDraft(),
      rowKey: '2026-03-02:10:NORMAL',
      patch: { deliveryMode: 'ONLINE' },
    });
    const [row] = buildTeachingPlanFormalRows(course, draft);

    expect(row).toMatchObject({ deliveryMode: 'ONLINE', location: '课表教室' });
  });

  it('逐行地点覆盖后端默认值，整体修改时可一次清除全部覆盖', () => {
    const course = buildTeachingPlanProjection([occurrence()]).courses[0]!;
    const draft = updateTeachingPlanRowDraft({
      draft: createEmptyTeachingPlanCourseDraft(),
      rowKey: '2026-03-02:10:NORMAL',
      patch: { locationOverride: '实训楼 201' },
    });

    expect(buildTeachingPlanFormalRows(course, draft)[0]?.location).toBe('实训楼 201');
    expect(
      buildTeachingPlanFormalRows(course, clearTeachingPlanLocationOverrides(draft))[0]?.location,
    ).toBe('课表教室');
  });

  it('可补齐、编辑、移动和删除固定的章节与作业内容组', () => {
    let draft = createEmptyTeachingPlanCourseDraft(3);
    const firstId = draft.contentRows[0]!.id;
    const thirdId = draft.contentRows[2]!.id;
    draft = updateTeachingPlanContentRow({
      contentRowId: firstId,
      draft,
      patch: { chapterAndContent: '第一章', homework: '作业一' },
    });
    draft = moveTeachingPlanContentRow({ draft, fromIndex: 0, toIndex: 2 });

    expect(draft.contentRows.map((row) => row?.id)).toEqual([expect.any(String), thirdId, firstId]);
    expect(draft.contentRows[2]).toMatchObject({
      chapterAndContent: '第一章',
      homework: '作业一',
    });

    draft = deleteTeachingPlanContentRow({ contentRowId: thirdId, draft });
    expect(draft.contentRows).toHaveLength(2);
    expect(draft.contentRows.some((row) => row?.id === thirdId)).toBe(false);
  });

  it('内容不足时可拖到后方空格，并保留来源与中间的未定义位置', () => {
    const original = createEmptyTeachingPlanCourseDraft(43);
    const row42 = original.contentRows[41];
    const row43 = original.contentRows[42];
    const draft = moveTeachingPlanContentRowToEmptySlot({
      draft: original,
      fromIndex: 41,
      toIndex: 45,
    });

    expect(draft.contentRows).toHaveLength(46);
    expect(draft.contentRows[41]).toBeNull();
    expect(draft.contentRows[42]).toBe(row43);
    expect(draft.contentRows[43]).toBeNull();
    expect(draft.contentRows[44]).toBeNull();
    expect(draft.contentRows[45]).toBe(row42);
    expect(draft.contentRows.filter((row) => row !== null)).toHaveLength(43);
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
