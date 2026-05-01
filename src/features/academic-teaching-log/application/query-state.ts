import type { AcademicTeachingLogPrefillResult } from './types';

export type LectureJournalQueryState = {
  isLoadingReconciliation: boolean;
  prefillResult: AcademicTeachingLogPrefillResult | null;
  queryError: string | null;
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
  | { type: 'settled' }
  | { type: 'started' }
  | {
      prefillResult: AcademicTeachingLogPrefillResult;
      type: 'succeeded';
    };

export const initialLectureJournalQueryState: LectureJournalQueryState = {
  isLoadingReconciliation: false,
  prefillResult: null,
  queryError: null,
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
    if (!state.prefillResult?.reconciliation) {
      return state;
    }

    return {
      ...state,
      prefillResult: {
        ...state.prefillResult,
        reconciliation: {
          ...state.prefillResult.reconciliation,
          items: state.prefillResult.reconciliation.items.map((currentItem) => {
            if (buildReconciliationItemKey(currentItem) !== action.itemKey) {
              return currentItem;
            }

            return {
              ...currentItem,
              journal: {
                completeAndSummary: currentItem.journal?.completeAndSummary ?? null,
                courseContent: action.courseContent,
                disciplineSituation: currentItem.journal?.disciplineSituation ?? null,
                homeworkAssignment: action.homeworkAssignment,
                lectureJournalDetailId:
                  action.lectureJournalDetailId ||
                  currentItem.journal?.lectureJournalDetailId ||
                  null,
                lectureJournalId: currentItem.journal?.lectureJournalId ?? null,
                problemAndSolve: currentItem.journal?.problemAndSolve ?? null,
                rawJournal: currentItem.journal?.rawJournal ?? null,
                securityAndMaintain: currentItem.journal?.securityAndMaintain ?? null,
                shift: currentItem.journal?.shift ?? null,
                statusCode: currentItem.journal?.statusCode ?? null,
                statusName: currentItem.journal?.statusName ?? null,
                topicRecord: action.topicRecord || currentItem.journal?.topicRecord || null,
              },
              status: 'FILLED',
            };
          }),
        },
      },
    };
  }

  if (action.type === 'succeeded') {
    return {
      ...state,
      isLoadingReconciliation: false,
      prefillResult: action.prefillResult,
      queryError: null,
    };
  }

  if (action.type === 'failed') {
    return {
      ...state,
      isLoadingReconciliation: false,
      queryError: action.message,
    };
  }

  if (action.type === 'settled') {
    return {
      ...state,
      isLoadingReconciliation: false,
    };
  }

  return state;
}
