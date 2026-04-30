import type { AcademicTeachingLogPrefillResult, LectureJournalReconciliationResult } from './api';

export type LectureJournalQueryState = {
  isLoadingPrefill: boolean;
  isLoadingReconciliation: boolean;
  prefillError: string | null;
  prefillResult: AcademicTeachingLogPrefillResult | null;
  queryError: string | null;
  reconciliationResult: LectureJournalReconciliationResult | null;
};

export type LectureJournalQueryAction =
  | { type: 'failed'; message: string }
  | { prefillResult: AcademicTeachingLogPrefillResult | null; type: 'prefillResultUpdated' }
  | { type: 'prefillStarted' }
  | { result: LectureJournalReconciliationResult; type: 'reconciliationLoaded' }
  | {
      reconciliationResult: LectureJournalReconciliationResult | null;
      type: 'reconciliationResultUpdated';
    }
  | { type: 'settled' }
  | { type: 'started' }
  | {
      prefillError: string | null;
      prefillResult: AcademicTeachingLogPrefillResult | null;
      reconciliationResult: LectureJournalReconciliationResult;
      type: 'succeeded';
    };

export const initialLectureJournalQueryState: LectureJournalQueryState = {
  isLoadingPrefill: false,
  isLoadingReconciliation: false,
  prefillError: null,
  prefillResult: null,
  queryError: null,
  reconciliationResult: null,
};

export function lectureJournalQueryReducer(
  state: LectureJournalQueryState,
  action: LectureJournalQueryAction,
): LectureJournalQueryState {
  if (action.type === 'started') {
    return {
      ...initialLectureJournalQueryState,
      isLoadingReconciliation: true,
    };
  }

  if (action.type === 'reconciliationLoaded') {
    return {
      ...state,
      isLoadingReconciliation: false,
      reconciliationResult: action.result,
    };
  }

  if (action.type === 'prefillStarted') {
    return {
      ...state,
      isLoadingPrefill: true,
    };
  }

  if (action.type === 'prefillResultUpdated') {
    return {
      ...state,
      prefillResult: action.prefillResult,
    };
  }

  if (action.type === 'reconciliationResultUpdated') {
    return {
      ...state,
      reconciliationResult: action.reconciliationResult,
    };
  }

  if (action.type === 'succeeded') {
    return {
      ...state,
      isLoadingPrefill: false,
      isLoadingReconciliation: false,
      prefillError: action.prefillError,
      prefillResult: action.prefillResult,
      queryError: null,
      reconciliationResult: action.reconciliationResult,
    };
  }

  if (action.type === 'failed') {
    return {
      ...state,
      isLoadingPrefill: false,
      isLoadingReconciliation: false,
      queryError: action.message,
    };
  }

  if (action.type === 'settled') {
    return {
      ...state,
      isLoadingPrefill: false,
      isLoadingReconciliation: false,
    };
  }

  return state;
}
