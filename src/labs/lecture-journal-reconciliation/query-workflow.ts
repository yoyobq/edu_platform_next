import type { StoredUpstreamSession } from '@/entities/upstream-session';

import {
  type AcademicTeachingLogPrefillResult,
  fetchAcademicTeachingLogPrefillItems,
  fetchLectureJournalReconciliation,
  isExpiredUpstreamSessionError,
  type LectureJournalReconciliationResult,
  resolveUpstreamErrorMessage,
} from './api';

type PersistRollingSession = (
  currentSession: StoredUpstreamSession,
  input: {
    expiresAt?: string | null;
    upstreamSessionToken: string;
  },
) => StoredUpstreamSession;

type QueryWorkflowParams = {
  departmentId?: string;
  persistRollingSession: PersistRollingSession;
  schoolYear: string;
  semester: string;
  semesterId: number;
  session: StoredUpstreamSession;
  staffId?: string;
};

type QueryWorkflowOutcome = {
  prefillError: string | null;
  prefillResult: AcademicTeachingLogPrefillResult | null;
  reconciliationResult: LectureJournalReconciliationResult;
};

export async function runLectureJournalReconciliationQueryWorkflow(
  params: QueryWorkflowParams,
): Promise<QueryWorkflowOutcome> {
  const reconciliationResult = await fetchLectureJournalReconciliation({
    departmentId: params.departmentId,
    schoolYear: params.schoolYear,
    semester: params.semester,
    sessionToken: params.session.upstreamSessionToken,
    staffId: params.staffId,
  });
  const nextSession = params.persistRollingSession(params.session, {
    expiresAt: reconciliationResult.expiresAt,
    upstreamSessionToken: reconciliationResult.upstreamSessionToken,
  });

  if (!params.staffId) {
    return {
      prefillError: null,
      prefillResult: null,
      reconciliationResult,
    };
  }

  try {
    const prefillResult = await fetchAcademicTeachingLogPrefillItems({
      departmentId: params.departmentId,
      semesterId: params.semesterId,
      staffId: params.staffId,
      upstreamSessionToken: reconciliationResult.upstreamSessionToken,
    });

    if (prefillResult.upstreamSessionToken && prefillResult.expiresAt) {
      params.persistRollingSession(nextSession, {
        expiresAt: prefillResult.expiresAt,
        upstreamSessionToken: prefillResult.upstreamSessionToken,
      });
    }

    return {
      prefillError: null,
      prefillResult,
      reconciliationResult,
    };
  } catch (error) {
    if (isExpiredUpstreamSessionError(error)) {
      throw error;
    }

    return {
      prefillError: resolveUpstreamErrorMessage(error, '暂时无法加载一体化预填结果。'),
      prefillResult: null,
      reconciliationResult,
    };
  }
}
