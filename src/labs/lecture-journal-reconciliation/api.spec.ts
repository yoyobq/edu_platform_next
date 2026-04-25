import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isExpiredUpstreamSessionErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isExpiredUpstreamSessionErrorMock: vi.fn(() => false),
}));

vi.mock('@/entities/upstream-session', () => ({
  isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  fetchLectureJournalDepartmentOptions,
  fetchLectureJournalReconciliation,
  fetchTeacherDirectory,
} from './api';

describe('lecture-journal-reconciliation api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReturnValue(false);
  });

  it('requests teacher directory with the current session token', async () => {
    const payload = {
      expiresAt: '2026-04-25T12:00:00.000Z',
      teachers: [
        {
          code: 'T-001',
          image: '',
          name: '张老师',
          text: '张老师 / T-001',
          value: 'STAFF-001',
        },
      ],
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchTeacherDirectory: payload,
    });

    await expect(
      fetchTeacherDirectory({
        sessionToken: 'rolling-token-001',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchTeacherDirectory'),
      {
        sessionToken: 'rolling-token-001',
      },
    );
  });

  it('requests enabled department options for the department selector', async () => {
    const payload = [
      {
        departmentName: '人工智能系',
        id: 'ORG0302',
        isEnabled: true,
        shortName: 'AI',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      departments: payload,
    });

    await expect(fetchLectureJournalDepartmentOptions()).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('LectureJournalReconciliationDepartments'),
      {
        isEnabled: true,
        limit: 500,
      },
    );
  });

  it('requests reconciliation with trimmed teacher filters', async () => {
    const payload = {
      expiresAt: '2026-04-25T12:00:00.000Z',
      filledCount: 8,
      items: [],
      journalCount: 8,
      missingCount: 2,
      missingItems: [],
      planCount: 1,
      planDetailCount: 10,
      unmatchedPlanItemCount: 1,
      unmatchedPlanItems: [],
      upstreamSessionToken: 'rolling-token-003',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchLectureJournalReconciliation: payload,
    });

    await expect(
      fetchLectureJournalReconciliation({
        departmentId: ' ORG0302 ',
        schoolYear: ' 2025 ',
        semester: ' 2 ',
        sessionToken: 'rolling-token-002',
        staffId: ' STAFF-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchLectureJournalReconciliation'),
      {
        departmentId: 'ORG0302',
        schoolYear: '2025',
        semester: '2',
        sessionToken: 'rolling-token-002',
        staffId: 'STAFF-001',
      },
    );
  });

  it('allows semester-level reconciliation without teacher filters', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      fetchLectureJournalReconciliation: {
        expiresAt: '2026-04-25T12:00:00.000Z',
        filledCount: 0,
        items: [],
        journalCount: 0,
        missingCount: 0,
        missingItems: [],
        planCount: 0,
        planDetailCount: 0,
        unmatchedPlanItemCount: 0,
        unmatchedPlanItems: [],
        upstreamSessionToken: 'rolling-token-004',
      },
    });

    await fetchLectureJournalReconciliation({
      departmentId: ' ',
      schoolYear: '2025',
      semester: '1',
      sessionToken: 'rolling-token-003',
      staffId: ' ',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchLectureJournalReconciliation'),
      {
        departmentId: undefined,
        schoolYear: '2025',
        semester: '1',
        sessionToken: 'rolling-token-003',
        staffId: undefined,
      },
    );
  });

  it('rejects when departmentId and staffId are not paired', async () => {
    await expect(
      fetchLectureJournalReconciliation({
        departmentId: 'ORG0302',
        schoolYear: '2025',
        semester: '2',
        sessionToken: 'rolling-token-002',
      }),
    ).rejects.toThrow('departmentId 和 staffId 需要同时传入，或同时留空。');

    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });

  it('rethrows expired upstream session errors for relogin handling', async () => {
    const expiredError = new Error('expired');

    executeGraphQLMock.mockRejectedValueOnce(expiredError);
    isExpiredUpstreamSessionErrorMock.mockReturnValueOnce(true);

    await expect(
      fetchLectureJournalReconciliation({
        schoolYear: '2025',
        semester: '2',
        sessionToken: 'rolling-token-002',
      }),
    ).rejects.toBe(expiredError);
  });
});
