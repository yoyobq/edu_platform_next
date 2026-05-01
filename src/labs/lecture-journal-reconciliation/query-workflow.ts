import type { StoredUpstreamSession } from '@/entities/upstream-session';
import {
  hasRollingUpstreamSessionResult,
  type PersistUpstreamSessionFromResult,
} from '@/entities/upstream-session';

import {
  type AcademicTeachingLogPrefillResult,
  fetchAcademicTeachingLogPrefillItems,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from './api';

type QueryWorkflowParams = {
  isCurrent?: () => boolean;
  persistSessionFromResult: PersistUpstreamSessionFromResult;
  semesterId: number;
  session: StoredUpstreamSession;
  staffId: string;
};

type QueryWorkflowOutcome = {
  prefillResult: AcademicTeachingLogPrefillResult;
};

export async function runLectureJournalReconciliationQueryWorkflow(
  params: QueryWorkflowParams,
): Promise<QueryWorkflowOutcome> {
  try {
    const prefillResult = await fetchAcademicTeachingLogPrefillItems({
      semesterId: params.semesterId,
      staffId: params.staffId,
      upstreamSessionToken: params.session.upstreamSessionToken,
    });

    if (params.isCurrent && !params.isCurrent()) {
      return {
        prefillResult,
      };
    }

    if (hasRollingUpstreamSessionResult(prefillResult)) {
      params.persistSessionFromResult(params.session, prefillResult);
    }

    return {
      prefillResult,
    };
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载教学日志对账结果。'));
  }
}
