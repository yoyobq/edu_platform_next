import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchAcademicTeachingLogPrefillItemsMock,
  isExpiredUpstreamSessionErrorMock,
  resolveUpstreamErrorMessageMock,
} = vi.hoisted(() => ({
  fetchAcademicTeachingLogPrefillItemsMock: vi.fn(),
  isExpiredUpstreamSessionErrorMock: vi.fn(() => false),
  resolveUpstreamErrorMessageMock: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
}));

import { runLectureJournalReconciliationQueryWorkflow } from './query-workflow';

describe('academic-teaching-log query workflow', () => {
  const session = {
    accountId: 1,
    expiresAt: '2026-04-30T12:00:00.000Z',
    upstreamLoginId: 'teacher001',
    upstreamSessionToken: 'token-001',
    version: 2 as const,
  };

  const persistSessionFromResult = vi.fn((currentSession, input) => ({
    ...currentSession,
    expiresAt: input.expiresAt ?? currentSession.expiresAt,
    upstreamSessionToken: input.upstreamSessionToken,
  }));

  const prefillResult = {
    blockingIssue: null,
    canFill: true,
    expiresAt: '2026-04-30T13:30:00.000Z',
    integratedPreviews: [],
    items: [],
    reconciliation: {
      filledCount: 1,
      items: [],
      journalCount: 1,
      missingCount: 0,
      planCount: 1,
      planDetailCount: 1,
      unmatchedPlanItemCount: 0,
      unmatchedPlanItems: [],
    },
    upstreamSessionToken: 'token-001',
    warnings: [],
  };

  beforeEach(() => {
    fetchAcademicTeachingLogPrefillItemsMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReturnValue(false);
    persistSessionFromResult.mockClear();
    resolveUpstreamErrorMessageMock.mockClear();
  });

  it('loads prefill and reconciliation through the single prefill endpoint', async () => {
    fetchAcademicTeachingLogPrefillItemsMock.mockResolvedValueOnce(prefillResult);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        fetchAcademicTeachingLogPrefillItems: fetchAcademicTeachingLogPrefillItemsMock,
        isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
        persistSessionFromResult,
        resolveUpstreamErrorMessage: resolveUpstreamErrorMessageMock,
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).resolves.toEqual({
      prefillResult,
    });

    expect(fetchAcademicTeachingLogPrefillItemsMock).toHaveBeenCalledWith({
      semesterId: 202502,
      staffId: 'STAFF-001',
      upstreamSessionToken: 'token-001',
    });
    expect(persistSessionFromResult).toHaveBeenCalledTimes(1);
    expect(persistSessionFromResult).toHaveBeenCalledWith(session, prefillResult);
  });

  it('does not persist the prefill session when the request is stale', async () => {
    fetchAcademicTeachingLogPrefillItemsMock.mockResolvedValueOnce(prefillResult);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        fetchAcademicTeachingLogPrefillItems: fetchAcademicTeachingLogPrefillItemsMock,
        isCurrent: () => false,
        isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
        persistSessionFromResult,
        resolveUpstreamErrorMessage: resolveUpstreamErrorMessageMock,
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).resolves.toEqual({
      prefillResult,
    });

    expect(persistSessionFromResult).not.toHaveBeenCalled();
  });

  it('rethrows expired upstream session errors from prefill loading', async () => {
    const expiredError = new Error('expired');

    fetchAcademicTeachingLogPrefillItemsMock.mockRejectedValueOnce(expiredError);
    isExpiredUpstreamSessionErrorMock.mockReturnValueOnce(true);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        fetchAcademicTeachingLogPrefillItems: fetchAcademicTeachingLogPrefillItemsMock,
        isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
        persistSessionFromResult,
        resolveUpstreamErrorMessage: resolveUpstreamErrorMessageMock,
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).rejects.toBe(expiredError);
  });

  it('wraps non-session prefill errors with the page fallback', async () => {
    fetchAcademicTeachingLogPrefillItemsMock.mockRejectedValueOnce(new Error('network failed'));

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        fetchAcademicTeachingLogPrefillItems: fetchAcademicTeachingLogPrefillItemsMock,
        isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
        persistSessionFromResult,
        resolveUpstreamErrorMessage: resolveUpstreamErrorMessageMock,
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).rejects.toThrow('network failed');
  });
});
