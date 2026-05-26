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

import {
  fetchClassDirectory,
  fetchCurriculumPlanDetail,
  fetchLectureJournalList,
  fetchLectureJournalTeachingClassSamples,
  fetchMajorDirectory,
  fetchPreviousClassAdviserClasses,
} from './api';

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

  it('requests major directory with a trimmed department id', async () => {
    const payload = {
      expiresAt: '2026-04-25T12:00:00.000Z',
      majors: [
        {
          code: 'MAJOR-001',
          image: '',
          name: '软件技术',
          text: '软件技术',
          value: 'MAJOR-001',
        },
      ],
      upstreamSessionToken: 'rolling-token-004',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchMajorDirectory: payload,
    });

    await expect(
      fetchMajorDirectory({
        departmentId: ' ORG0302 ',
        sessionToken: 'rolling-token-003',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('FetchMajorDirectory'),
      {
        departmentId: 'ORG0302',
        sessionToken: 'rolling-token-003',
      },
    );
  });

  it('requests class directory with nullable filters', async () => {
    const payload = {
      classes: [
        {
          code: '1031501',
          image: '',
          name: '信息1501班',
          text: '信息1501班',
          value: '1031501',
        },
      ],
      expiresAt: '2026-04-25T12:00:00.000Z',
      upstreamSessionToken: 'rolling-token-005',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchClassDirectory: payload,
    });

    await expect(
      fetchClassDirectory({
        annualMajorId: ' ',
        departmentId: ' ORG0302 ',
        schoolYear: ' ',
        semester: ' ',
        sessionToken: 'rolling-token-004',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('$schoolYear: String');
    expect(query).toContain('$semester: String');
    expect(query).not.toContain('$schoolYear: String!');
    expect(query).not.toContain('$semester: String!');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('FetchClassDirectory'),
      {
        annualMajorId: null,
        departmentId: 'ORG0302',
        schoolYear: null,
        semester: null,
        sessionToken: 'rolling-token-004',
      },
    );
  });

  it('requests previous class adviser classes with the upstream session token', async () => {
    const payload = {
      classes: [
        {
          code: '1031301',
          image: '',
          name: '信息1301班',
          text: '信息1301班',
          value: '1031301',
        },
      ],
      count: 1,
      expiresAt: '2026-05-26T12:00:00.000Z',
      upstreamSessionToken: 'rolling-token-006',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchPreviousClassAdviserClasses: payload,
    });

    await expect(
      fetchPreviousClassAdviserClasses({
        sessionToken: 'rolling-token-005',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('FetchPreviousClassAdviserClasses'),
      {
        sessionToken: 'rolling-token-005',
      },
    );
  });

  it('requests curriculum plan detail with the selected plan id', async () => {
    const payload = {
      count: 1,
      details: {
        planId: 'PLAN-001',
        sections: [
          {
            courseName: '高等数学',
          },
        ],
      },
      expiresAt: '2026-04-25T12:00:00.000Z',
      upstreamSessionToken: 'rolling-token-003',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchCurriculumPlanDetail: payload,
    });

    await expect(
      fetchCurriculumPlanDetail({
        planId: 'PLAN-001',
        sessionToken: 'rolling-token-002',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('fetchCurriculumPlanDetail'),
      {
        planId: 'PLAN-001',
        sessionToken: 'rolling-token-002',
      },
    );
  });
});
