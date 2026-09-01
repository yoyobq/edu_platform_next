import { describe, expect, it } from 'vitest';

import type { CurriculumPlanDetailReferenceCandidate } from '../types';

import { replaceTeachingPlanContentRowsFromHistory } from './historical-plan-fill';
import {
  createEmptyTeachingPlanCourseDraft,
  updateTeachingPlanContentRow,
} from './teaching-plan-sheet';

describe('historical teaching plan fill', () => {
  it('用历史计划完整替换现有 F/G 内容、顺序和行数', () => {
    const seededDraft = createEmptyTeachingPlanCourseDraft(1);
    const original = updateTeachingPlanContentRow({
      contentRowId: seededDraft.contentRows[0]!.id,
      draft: seededDraft,
      patch: { chapterAndContent: '教师已填写内容', homework: '教师已填写作业' },
    });

    const result = replaceTeachingPlanContentRowsFromHistory({
      draft: original,
      reference: referenceCandidate(),
    });

    expect(result.draft.contentRows.map((row) => [row?.chapterAndContent, row?.homework])).toEqual([
      ['历史内容 1', '历史作业 1'],
      ['历史内容 2', '历史作业 2'],
    ]);
    expect(result).toMatchObject({
      previousRowCount: 1,
      referenceRowCount: 2,
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
