// src/features/class-affairs-course-results/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, executeUpstreamSessionGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  executeUpstreamSessionGraphQLMock: vi.fn(),
}));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  fetchManagedClassCourseResults,
  listMyManagedClasses,
  normalizeFetchManagedClassCourseResultsInput,
} from './api';

describe('class affairs course results api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
  });

  it('normalizes cache reads and upstream refresh input', () => {
    expect(
      normalizeFetchManagedClassCourseResultsInput({
        classCode: ' 2501 ',
        refreshMode: 'CACHE_FIRST',
        schoolYear: ' 2025 ',
        semester: ' 1 ',
      }),
    ).toEqual({
      classCode: '2501',
      refreshMode: 'CACHE_FIRST',
      schoolYear: '2025',
      semester: '1',
    });

    expect(
      normalizeFetchManagedClassCourseResultsInput({
        classCode: ' 2501 ',
        refreshMode: 'REFRESH',
        upstreamSessionToken: ' token-1 ',
      }),
    ).toEqual({
      classCode: '2501',
      refreshMode: 'REFRESH',
      sessionToken: 'token-1',
    });
  });

  it('loads my managed classes and keeps nullable classCode', async () => {
    const payload = [
      {
        classCode: '2501',
        className: '25计算机1班',
        departmentId: 'ORG01',
        gradeYear: 2025,
        id: 'class-1',
      },
      {
        classCode: null,
        className: '历史班级',
        departmentId: 'ORG01',
        gradeYear: null,
        id: 'class-2',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      myManagedClasses: payload,
    });

    await expect(listMyManagedClasses()).resolves.toBe(payload);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('MyManagedClasses'),
      {},
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('classCode');
  });

  it('reads cached managed class results through the existing course results mutation', async () => {
    const payload = {
      classCode: '2501',
      className: '25计算机1班',
      items: [],
      rowCount: 0,
      studentCount: 0,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchClassStudentCourseResults: payload,
    });

    await expect(
      fetchManagedClassCourseResults({
        classCode: '2501',
        refreshMode: 'CACHE_FIRST',
      }),
    ).resolves.toBe(payload);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('FetchClassStudentCourseResults'),
      {
        input: {
          classCode: '2501',
          refreshMode: 'CACHE_FIRST',
        },
      },
    );
  });

  it('refreshes managed class results through upstream session graphql', async () => {
    const payload = {
      classCode: '2501',
      className: '25计算机1班',
      expiresAt: '2026-06-14T10:00:00.000Z',
      items: [],
      rowCount: 0,
      studentCount: 0,
      upstreamSessionToken: 'token-2',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      fetchClassStudentCourseResults: payload,
    });

    await expect(
      fetchManagedClassCourseResults({
        classCode: '2501',
        refreshMode: 'REFRESH',
        schoolYear: '2025',
        semester: '2',
        upstreamSessionToken: 'token-1',
      }),
    ).resolves.toBe(payload);
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('FetchClassStudentCourseResults'),
      {
        input: {
          classCode: '2501',
          refreshMode: 'REFRESH',
          schoolYear: '2025',
          semester: '2',
          sessionToken: 'token-1',
        },
      },
    );
  });
});
