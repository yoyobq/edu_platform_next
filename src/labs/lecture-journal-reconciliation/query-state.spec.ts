import { describe, expect, it } from 'vitest';

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
});
