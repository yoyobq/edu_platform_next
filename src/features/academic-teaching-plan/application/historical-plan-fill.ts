// src/features/academic-teaching-plan/application/historical-plan-fill.ts

import type { CurriculumPlanDetailReferenceCandidate } from '../types';

import type { TeachingPlanContentRowDraft, TeachingPlanCourseDraft } from './teaching-plan-sheet';

export type HistoricalPlanReplaceResult = {
  draft: TeachingPlanCourseDraft;
  previousRowCount: number;
  referenceRowCount: number;
};

export function replaceTeachingPlanContentRowsFromHistory(input: {
  draft: TeachingPlanCourseDraft;
  reference: CurriculumPlanDetailReferenceCandidate;
}): HistoricalPlanReplaceResult {
  const contentRows: TeachingPlanContentRowDraft[] = input.reference.items.map((item, index) => ({
    chapterAndContent: item.chapterAndContent?.trim() ?? '',
    homework: item.homework?.trim() ?? '',
    id: `history:${input.reference.sourcePlanId}:${item.sourceDetailId ?? 'row'}:${index}`,
  }));

  return {
    draft: { ...input.draft, contentRows },
    previousRowCount: input.draft.contentRows.filter((row) => row !== null).length,
    referenceRowCount: contentRows.length,
  };
}
