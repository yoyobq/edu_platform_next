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
  | {
      completeAndSummary: string;
      disciplineSituation: string;
      lectureJournalDetailId: string | null;
      lecturePlanDetailId: string | null;
      lecturePlanId: string | null;
      problemAndSolve: string;
      securityAndMaintain: string;
      shift: string;
      type: 'integratedSaveApplied';
    }
  | {
      courseContent: string;
      homeworkAssignment: string;
      itemKey: string;
      lectureJournalDetailId: string | null;
      topicRecord: string;
      type: 'reconciliationSaveApplied';
    }
  | { type: 'prefillStarted' }
  | { result: LectureJournalReconciliationResult; type: 'reconciliationLoaded' }
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

function buildReconciliationItemKey(item: {
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  matchKey?: string | null;
  reason?: string | null;
}) {
  return [
    item.lecturePlanDetailId || 'detail',
    item.lecturePlanId || 'plan',
    item.matchKey || 'match',
    item.reason || 'reason',
  ].join('-');
}

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

  if (action.type === 'integratedSaveApplied') {
    if (!state.prefillResult) {
      return state;
    }

    return {
      ...state,
      prefillResult: {
        ...state.prefillResult,
        integratedPreviews: state.prefillResult.integratedPreviews.map((preview) => {
          const isTargetPreview =
            preview.lecturePlanDetailId === action.lecturePlanDetailId &&
            preview.lecturePlanId === action.lecturePlanId;

          if (!isTargetPreview) {
            return preview;
          }

          return {
            ...preview,
            completeAndSummary: action.completeAndSummary,
            disciplineSituation: action.disciplineSituation,
            matchedLectureJournalDetailId:
              action.lectureJournalDetailId || preview.matchedLectureJournalDetailId,
            problemAndSolve: action.problemAndSolve,
            securityAndMaintain: action.securityAndMaintain,
            shift: action.shift,
            status: 'FILLED',
          };
        }),
      },
    };
  }

  if (action.type === 'reconciliationSaveApplied') {
    if (!state.reconciliationResult) {
      return state;
    }

    return {
      ...state,
      reconciliationResult: {
        ...state.reconciliationResult,
        items: state.reconciliationResult.items.map((currentItem) => {
          if (buildReconciliationItemKey(currentItem) !== action.itemKey) {
            return currentItem;
          }

          return {
            ...currentItem,
            journal: {
              courseContent: action.courseContent,
              homeworkAssignment: action.homeworkAssignment,
              lectureJournalDetailId:
                action.lectureJournalDetailId ||
                currentItem.journal?.lectureJournalDetailId ||
                null,
              lectureJournalId: currentItem.journal?.lectureJournalId ?? null,
              rawJournal: currentItem.journal?.rawJournal ?? null,
              statusCode: currentItem.journal?.statusCode ?? null,
              statusName: currentItem.journal?.statusName ?? null,
              topicRecord: action.topicRecord || currentItem.journal?.topicRecord || null,
            },
            status: 'FILLED',
          };
        }),
      },
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
