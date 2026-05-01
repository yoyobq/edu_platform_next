import { describe, expect, it } from 'vitest';

import { initialLectureJournalQueryState, lectureJournalQueryReducer } from './query-state';
import type { AcademicTeachingLogPrefillResult } from './types';

describe('academic-teaching-log query state', () => {
  const prefillResult = {
    blockingIssue: null,
    canFill: true,
    expiresAt: '2026-04-30T13:30:00.000Z',
    integratedPreviews: [],
    items: [],
    reconciliation: {
      filledCount: 0,
      items: [],
      journalCount: 0,
      missingCount: 0,
      planCount: 0,
      planDetailCount: 0,
      unmatchedPlanItemCount: 0,
      unmatchedPlanItems: [],
    },
    upstreamSessionToken: 'token-003',
    warnings: [],
  } satisfies AcademicTeachingLogPrefillResult;

  it('resets stale query data when a new query starts', () => {
    const state = lectureJournalQueryReducer(
      {
        isLoadingReconciliation: false,
        prefillResult,
        queryError: '旧查询错误',
      },
      { type: 'started' },
    );

    expect(state).toEqual({
      ...initialLectureJournalQueryState,
      isLoadingReconciliation: true,
    });
  });

  it('stores prefill and reconciliation from the single query result', () => {
    const state = lectureJournalQueryReducer(initialLectureJournalQueryState, {
      prefillResult,
      type: 'succeeded',
    });

    expect(state).toEqual({
      ...initialLectureJournalQueryState,
      prefillResult,
    });
  });

  it('applies integrated save results against the current reducer state', () => {
    const state = lectureJournalQueryReducer(
      {
        ...initialLectureJournalQueryState,
        prefillResult: {
          ...prefillResult,
          integratedPreviews: [
            {
              lecturePlanDetailId: 'PLAN-DETAIL-001',
              lecturePlanId: 'PLAN-001',
              matchedLectureJournalDetailId: null,
            },
          ],
        } as unknown as AcademicTeachingLogPrefillResult,
      },
      {
        completeAndSummary: '已完成',
        disciplineSituation: '遵章守纪',
        lectureJournalDetailId: 'DETAIL-001',
        lecturePlanDetailId: 'PLAN-DETAIL-001',
        lecturePlanId: 'PLAN-001',
        problemAndSolve: '无',
        securityAndMaintain: '注意安全',
        shift: '3',
        type: 'integratedSaveApplied',
      },
    );

    expect(state.prefillResult?.integratedPreviews[0]).toEqual(
      expect.objectContaining({
        completeAndSummary: '已完成',
        matchedLectureJournalDetailId: 'DETAIL-001',
        status: 'FILLED',
      }),
    );
  });

  it('applies reconciliation save results inside prefill.reconciliation', () => {
    const state = lectureJournalQueryReducer(
      {
        ...initialLectureJournalQueryState,
        prefillResult: {
          ...prefillResult,
          reconciliation: {
            ...prefillResult.reconciliation,
            items: [
              {
                journal: null,
                lecturePlanDetailId: 'PLAN-DETAIL-001',
                lecturePlanId: 'PLAN-001',
                matchKey: 'MATCH-001',
                reason: null,
                status: 'MISSING',
              },
            ],
          },
        } as unknown as AcademicTeachingLogPrefillResult,
      },
      {
        courseContent: '课程内容',
        homeworkAssignment: '作业',
        itemKey: 'PLAN-DETAIL-001-PLAN-001-MATCH-001-reason',
        lectureJournalDetailId: 'DETAIL-001',
        topicRecord: '优',
        type: 'reconciliationSaveApplied',
      },
    );

    expect(state.prefillResult?.reconciliation?.items[0]).toEqual(
      expect.objectContaining({
        journal: expect.objectContaining({
          courseContent: '课程内容',
          lectureJournalDetailId: 'DETAIL-001',
          topicRecord: '优',
        }),
        status: 'FILLED',
      }),
    );
  });
});
