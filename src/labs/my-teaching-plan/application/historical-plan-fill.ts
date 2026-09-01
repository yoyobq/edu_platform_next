import type { CurriculumPlanDetailReferenceCandidate } from '../types';

import type { TeachingPlanCourseProjection } from './teaching-plan-projection';
import {
  buildTeachingPlanSheetRows,
  type TeachingPlanCourseDraft,
  updateTeachingPlanRowDraft,
} from './teaching-plan-sheet';

export type HistoricalPlanFillResult = {
  draft: TeachingPlanCourseDraft;
  filledCellCount: number;
  filledRowCount: number;
  mappedRowCount: number;
  referenceRowCount: number;
  targetRowCount: number;
};

export function fillEmptyTeachingPlanRowsFromHistory(input: {
  course: TeachingPlanCourseProjection;
  draft: TeachingPlanCourseDraft;
  reference: CurriculumPlanDetailReferenceCandidate;
}): HistoricalPlanFillResult {
  const targetRows = buildTeachingPlanSheetRows(input.course, input.draft);
  const mappedRowCount = Math.min(targetRows.length, input.reference.items.length);
  let draft = input.draft;
  let filledCellCount = 0;
  let filledRowCount = 0;

  for (let index = 0; index < mappedRowCount; index += 1) {
    const target = targetRows[index];
    const source = input.reference.items[index];
    if (!target || !source) {
      continue;
    }
    const patch: { chapterAndContent?: string; homework?: string } = {};
    const chapterAndContent = source.chapterAndContent?.trim();
    const homework = source.homework?.trim();
    if (!target.chapterAndContent.trim() && chapterAndContent) {
      patch.chapterAndContent = chapterAndContent;
      filledCellCount += 1;
    }
    if (!target.homework.trim() && homework) {
      patch.homework = homework;
      filledCellCount += 1;
    }
    if (Object.keys(patch).length > 0) {
      draft = updateTeachingPlanRowDraft({ draft, patch, rowKey: target.rowKey });
      filledRowCount += 1;
    }
  }

  return {
    draft,
    filledCellCount,
    filledRowCount,
    mappedRowCount,
    referenceRowCount: input.reference.items.length,
    targetRowCount: targetRows.length,
  };
}
