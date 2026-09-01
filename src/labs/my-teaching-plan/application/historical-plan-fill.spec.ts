import { describe, expect, it } from 'vitest';

import type { CurriculumPlanDetailReferenceCandidate, TeachingPlanOccurrence } from '../types';

import { fillEmptyTeachingPlanRowsFromHistory } from './historical-plan-fill';
import { buildTeachingPlanProjection } from './teaching-plan-projection';
import {
  buildTeachingPlanSheetRows,
  createEmptyTeachingPlanCourseDraft,
  updateTeachingPlanRowDraft,
} from './teaching-plan-sheet';

describe('historical teaching plan fill', () => {
  it('按课次顺序只补空白 F/G，不覆盖已有编辑', () => {
    const course = buildTeachingPlanProjection([
      occurrence({ slotId: 10, date: '2026-03-02' }),
      occurrence({ slotId: 11, date: '2026-03-09', weekIndex: 2 }),
    ]).courses[0]!;
    const original = updateTeachingPlanRowDraft({
      draft: createEmptyTeachingPlanCourseDraft(),
      rowKey: '2026-03-02:10:NORMAL',
      patch: { chapterAndContent: '教师已填写内容' },
    });

    const result = fillEmptyTeachingPlanRowsFromHistory({
      course,
      draft: original,
      reference: referenceCandidate(),
    });
    const rows = buildTeachingPlanSheetRows(course, result.draft);

    expect(rows.map((row) => [row.chapterAndContent, row.homework])).toEqual([
      ['教师已填写内容', '历史作业 1'],
      ['历史内容 2', '历史作业 2'],
    ]);
    expect(result).toMatchObject({
      filledCellCount: 3,
      filledRowCount: 2,
      mappedRowCount: 2,
      referenceRowCount: 2,
      targetRowCount: 2,
    });
  });
});

function referenceCandidate(): CurriculumPlanDetailReferenceCandidate {
  return {
    sourcePlanId: 'PLAN-OLD',
    schoolYear: '2025',
    semester: '2',
    courseName: '网页设计',
    teachingClassName: '信息 2501 班',
    weekCount: 16,
    weeklyHours: 2,
    plannedLessons: 32,
    plannedLessonsDiff: 0,
    matchKind: 'EXACT',
    rank: 1,
    recommended: true,
    items: [detail('历史内容 1', '历史作业 1'), detail('历史内容 2', '历史作业 2')],
  };
}

function detail(chapterAndContent: string, homework: string) {
  return {
    sourceDetailId: null,
    weekNumber: null,
    dayOfWeek: null,
    sectionId: null,
    sectionName: null,
    lessonHours: 2,
    chapterAndContent,
    homework,
  };
}

function occurrence(overrides: Partial<TeachingPlanOccurrence>): TeachingPlanOccurrence {
  return {
    calcEffect: 'NORMAL',
    classroomName: '课表教室',
    coefficient: '1.00',
    courseCategory: 'THEORY',
    courseName: '网页设计',
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
    teachingClassName: '信息 2501 班',
    weekIndex: 1,
    ...overrides,
  };
}
