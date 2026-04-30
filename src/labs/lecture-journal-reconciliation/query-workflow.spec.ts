import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchAcademicTeachingLogPrefillItemsMock,
  fetchLectureJournalReconciliationMock,
  isExpiredUpstreamSessionErrorMock,
  resolveUpstreamErrorMessageMock,
} = vi.hoisted(() => ({
  fetchAcademicTeachingLogPrefillItemsMock: vi.fn(),
  fetchLectureJournalReconciliationMock: vi.fn(),
  isExpiredUpstreamSessionErrorMock: vi.fn(() => false),
  resolveUpstreamErrorMessageMock: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
}));

vi.mock('./api', () => ({
  fetchAcademicTeachingLogPrefillItems: fetchAcademicTeachingLogPrefillItemsMock,
  fetchLectureJournalReconciliation: fetchLectureJournalReconciliationMock,
  isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
  resolveUpstreamErrorMessage: resolveUpstreamErrorMessageMock,
}));

import { runLectureJournalReconciliationQueryWorkflow } from './query-workflow';

describe('lecture-journal-reconciliation query workflow', () => {
  const session = {
    accountId: 1,
    expiresAt: '2026-04-30T12:00:00.000Z',
    upstreamLoginId: 'teacher001',
    upstreamSessionToken: 'token-001',
    version: 2 as const,
  };

  const persistRollingSession = vi.fn((currentSession, input) => ({
    ...currentSession,
    expiresAt: input.expiresAt ?? currentSession.expiresAt,
    upstreamSessionToken: input.upstreamSessionToken,
  }));

  beforeEach(() => {
    fetchAcademicTeachingLogPrefillItemsMock.mockReset();
    fetchLectureJournalReconciliationMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReturnValue(false);
    persistRollingSession.mockClear();
    resolveUpstreamErrorMessageMock.mockClear();
  });

  it('returns the main reconciliation result when no staff filter is provided', async () => {
    const reconciliationResult = {
      expiresAt: '2026-04-30T13:00:00.000Z',
      items: [],
      journalCount: 5,
      planCount: 4,
      planDetailCount: 10,
      upstreamSessionToken: 'token-002',
    };

    fetchLectureJournalReconciliationMock.mockResolvedValueOnce(reconciliationResult);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        persistRollingSession,
        schoolYear: '2025',
        semester: '2',
        semesterId: 202502,
        session,
      }),
    ).resolves.toEqual({
      prefillError: null,
      prefillResult: null,
      reconciliationResult,
    });

    expect(fetchAcademicTeachingLogPrefillItemsMock).not.toHaveBeenCalled();
    expect(persistRollingSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the main reconciliation result when prefill loading fails', async () => {
    const reconciliationResult = {
      expiresAt: '2026-04-30T13:00:00.000Z',
      items: [{ courseCategory: '3', courseName: '一体化' }],
      journalCount: 5,
      planCount: 4,
      planDetailCount: 10,
      upstreamSessionToken: 'token-002',
    };
    const prefillError = new Error('网络连接异常，请稍后重试。');

    fetchLectureJournalReconciliationMock.mockResolvedValueOnce(reconciliationResult);
    fetchAcademicTeachingLogPrefillItemsMock.mockRejectedValueOnce(prefillError);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        departmentId: 'ORG0302',
        persistRollingSession,
        schoolYear: '2025',
        semester: '2',
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).resolves.toEqual({
      prefillError: '网络连接异常，请稍后重试。',
      prefillResult: null,
      reconciliationResult,
    });

    expect(fetchAcademicTeachingLogPrefillItemsMock).toHaveBeenCalledTimes(1);
    expect(persistRollingSession).toHaveBeenCalledTimes(1);
  });

  it('skips prefill loading when the staff has no integrated courses', async () => {
    const reconciliationResult = {
      expiresAt: '2026-04-30T13:00:00.000Z',
      items: [{ courseCategory: '1', courseName: '理论课' }],
      journalCount: 5,
      planCount: 4,
      planDetailCount: 10,
      upstreamSessionToken: 'token-002',
    };

    fetchLectureJournalReconciliationMock.mockResolvedValueOnce(reconciliationResult);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        departmentId: 'ORG0302',
        persistRollingSession,
        schoolYear: '2025',
        semester: '2',
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).resolves.toEqual({
      prefillError: null,
      prefillResult: null,
      reconciliationResult,
    });

    expect(fetchAcademicTeachingLogPrefillItemsMock).not.toHaveBeenCalled();
    expect(persistRollingSession).toHaveBeenCalledTimes(1);
  });

  it('persists the latest rolling token when prefill succeeds', async () => {
    const reconciliationResult = {
      expiresAt: '2026-04-30T13:00:00.000Z',
      items: [{ courseCategory: '3', courseName: '一体化' }],
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

    fetchLectureJournalReconciliationMock.mockResolvedValueOnce(reconciliationResult);
    fetchAcademicTeachingLogPrefillItemsMock.mockResolvedValueOnce(prefillResult);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        departmentId: 'ORG0302',
        persistRollingSession,
        schoolYear: '2025',
        semester: '2',
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).resolves.toEqual({
      prefillError: null,
      prefillResult,
      reconciliationResult,
    });

    expect(persistRollingSession).toHaveBeenCalledTimes(2);
    expect(persistRollingSession).toHaveBeenNthCalledWith(1, session, {
      expiresAt: '2026-04-30T13:00:00.000Z',
      upstreamSessionToken: 'token-002',
    });
    expect(persistRollingSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        expiresAt: '2026-04-30T13:00:00.000Z',
        upstreamSessionToken: 'token-002',
      }),
      {
        expiresAt: '2026-04-30T13:30:00.000Z',
        upstreamSessionToken: 'token-003',
      },
    );
  });

  it('rethrows expired upstream session errors from prefill loading', async () => {
    const reconciliationResult = {
      expiresAt: '2026-04-30T13:00:00.000Z',
      items: [{ courseCategory: '3', courseName: '一体化' }],
      journalCount: 5,
      planCount: 4,
      planDetailCount: 10,
      upstreamSessionToken: 'token-002',
    };
    const expiredError = new Error('expired');

    fetchLectureJournalReconciliationMock.mockResolvedValueOnce(reconciliationResult);
    fetchAcademicTeachingLogPrefillItemsMock.mockRejectedValueOnce(expiredError);
    isExpiredUpstreamSessionErrorMock.mockReturnValueOnce(true);

    await expect(
      runLectureJournalReconciliationQueryWorkflow({
        departmentId: 'ORG0302',
        persistRollingSession,
        schoolYear: '2025',
        semester: '2',
        semesterId: 202502,
        session,
        staffId: 'STAFF-001',
      }),
    ).rejects.toBe(expiredError);
  });
});
