import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/entities/upstream-session', () => ({
  isExpiredUpstreamSessionError: vi.fn(() => false),
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import { fetchLectureJournalList, fetchLectureJournalTeachingClassSamples } from './api';

describe('upstream-session-demo api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('requests lecture journals with a trimmed teaching class id', async () => {
    const payload = {
      count: 2,
      expiresAt: '2026-04-25T12:00:00.000Z',
      journals: [
        {
          id: 'journal-1',
          week: 8,
        },
        {
          id: 'journal-2',
          week: 9,
        },
      ],
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchLectureJournalList: payload,
    });

    await expect(
      fetchLectureJournalList({
        sessionToken: 'rolling-token-001',
        teachingClassId: ' TC-2025-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchLectureJournalList'),
      {
        sessionToken: 'rolling-token-001',
        teachingClassId: 'TC-2025-001',
      },
    );
  });

  it('requests teaching class samples with a custom trimmed staff id', async () => {
    const payload = [
      {
        courseName: '高等数学',
        scheduleId: 101,
        staffId: 'STAFF-002',
        staffName: '张老师',
        sstsTeachingClassId: 'TC-001',
        teachingClassName: '高数 1 班',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicTeacherSemesterScheduleItems: {
        items: payload,
      },
    });

    await expect(
      fetchLectureJournalTeachingClassSamples({
        semesterId: 202601,
        staffId: ' STAFF-002 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('ListLectureJournalTeachingClassSamples'),
      {
        semesterId: 202601,
        staffId: 'STAFF-002',
      },
    );
  });
});
