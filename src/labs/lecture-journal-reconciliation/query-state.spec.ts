import { describe, expect, it } from 'vitest';

import type { AcademicTeachingLogPrefillResult, LectureJournalReconciliationResult } from './api';
import { initialLectureJournalQueryState, lectureJournalQueryReducer } from './query-state';

describe('lecture-journal-reconciliation query state', () => {
  const reconciliationResult = {
    expiresAt: '2026-04-30T13:00:00.000Z',
    items: [],
    journalCount: 5,
    planCount: 4,
    planDetailCount: 10,
    upstreamSessionToken: 'token-002',
  };
  const prefillResult = {
    blockingIssue: null,
    canFill: true,
    expiresAt: '2026-04-30T13:30:00.000Z',
    integratedPreviews: [],
    upstreamSessionToken: 'token-003',
    warnings: [],
  };

  it('resets stale query data when a new query starts', () => {
    const state = lectureJournalQueryReducer(
      {
        isLoadingPrefill: true,
        isLoadingReconciliation: false,
        prefillError: '旧预填错误',
        prefillResult,
        queryError: '旧查询错误',
        reconciliationResult,
      },
      { type: 'started' },
    );

    expect(state).toEqual({
      ...initialLectureJournalQueryState,
      isLoadingReconciliation: true,
    });
  });

  it('keeps the main reconciliation result visible while prefill keeps loading', () => {
    const loadedState = lectureJournalQueryReducer(initialLectureJournalQueryState, {
      result: reconciliationResult,
      type: 'reconciliationLoaded',
    });
    const prefillLoadingState = lectureJournalQueryReducer(loadedState, {
      type: 'prefillStarted',
    });

    expect(prefillLoadingState).toEqual({
      ...initialLectureJournalQueryState,
      isLoadingPrefill: true,
      reconciliationResult,
    });
  });

  it('keeps the main reconciliation result when prefill loading fails', () => {
    const loadedState = lectureJournalQueryReducer(initialLectureJournalQueryState, {
      result: reconciliationResult,
      type: 'reconciliationLoaded',
    });
    const finalState = lectureJournalQueryReducer(loadedState, {
      prefillError: '暂时无法加载一体化预填结果。',
      prefillResult: null,
      reconciliationResult,
      type: 'succeeded',
    });

    expect(finalState).toEqual({
      ...initialLectureJournalQueryState,
      prefillError: '暂时无法加载一体化预填结果。',
      reconciliationResult,
    });
  });

  it('applies integrated save results against the current reducer state', () => {
    const state = lectureJournalQueryReducer(
      {
        ...initialLectureJournalQueryState,
        prefillResult: {
          blockingIssue: null,
          canFill: true,
          expiresAt: null,
          integratedPreviews: [
            {
              lecturePlanDetailId: 'PLAN-DETAIL-001',
              lecturePlanId: 'PLAN-001',
              matchedLectureJournalDetailId: null,
            },
          ],
          upstreamSessionToken: null,
          warnings: [],
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

  it('applies reconciliation save results by the same item key used by cards', () => {
    const state = lectureJournalQueryReducer(
      {
        ...initialLectureJournalQueryState,
        reconciliationResult: {
          expiresAt: '2026-04-30T13:00:00.000Z',
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
          journalCount: 0,
          planCount: 1,
          planDetailCount: 1,
          upstreamSessionToken: 'token-002',
        } as unknown as LectureJournalReconciliationResult,
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

    expect(state.reconciliationResult?.items[0]).toEqual(
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
