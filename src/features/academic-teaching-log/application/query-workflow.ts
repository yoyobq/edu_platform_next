import {
  hasRollingUpstreamSessionResult,
  type PersistUpstreamSessionFromResult,
  type StoredUpstreamSession,
} from '@/entities/upstream-session';

import type {
  AcademicTeachingLogPrefillResult,
  FetchAcademicTeachingLogPrefillInput,
} from './types';

type QueryWorkflowPorts = {
  fetchAcademicTeachingLogPrefillItems: (
    input: FetchAcademicTeachingLogPrefillInput,
  ) => Promise<AcademicTeachingLogPrefillResult>;
  isExpiredUpstreamSessionError: (error: unknown) => boolean;
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) => string;
};

type QueryWorkflowParams = QueryWorkflowPorts & {
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
    const prefillResult = await params.fetchAcademicTeachingLogPrefillItems({
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
    if (params.isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    throw new Error(params.resolveUpstreamErrorMessage(error, '暂时无法加载教学日志对账结果。'));
  }
}
