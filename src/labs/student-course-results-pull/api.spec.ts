// src/labs/student-course-results-pull/api.spec.ts

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
  fetchClassStudentCourseResults,
  listLocalClassOptions,
  listLocalDepartmentOptions,
  normalizeFetchClassStudentCourseResultsInput,
} from './api';

describe('student-course-results-pull api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('normalizes fetch input without treating local class id as classCode', () => {
    expect(
      normalizeFetchClassStudentCourseResultsInput({
        classCode: ' 1021904 ',
        refreshMode: 'REFRESH',
        schoolYear: ' 2024 ',
        semester: ' 1 ',
        sessionToken: ' rolling-token-001 ',
        studentNumbers: [' 219010401 ', '', '219010401', '219010402'],
      }),
    ).toEqual({
      classCode: '1021904',
      refreshMode: 'REFRESH',
      schoolYear: '2024',
      semester: '1',
      sessionToken: 'rolling-token-001',
      studentNumbers: ['219010401', '219010402'],
    });
  });

  it('omits schoolYear when requesting all school years', () => {
    expect(
      normalizeFetchClassStudentCourseResultsInput({
        classCode: '1021904',
        refreshMode: 'REFRESH',
        schoolYear: ' ',
        sessionToken: 'rolling-token-001',
      }),
    ).toEqual({
      classCode: '1021904',
      refreshMode: 'REFRESH',
      sessionToken: 'rolling-token-001',
    });
  });

  it('loads local class options with trimmed filters', async () => {
    const payload = [
      {
        classCode: '1021904',
        className: '19机电一体化4班',
        departmentId: 'ORG0301',
        gradeYear: 2019,
        id: 'local-class-id-1',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      listLocalClassOptions: payload,
    });

    await expect(
      listLocalClassOptions({
        departmentId: ' ORG0301 ',
        keyword: ' 1904 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentCourseResultsPullLocalClassOptions'),
      {
        input: {
          departmentId: 'ORG0301',
          keyword: '1904',
        },
      },
    );
  });

  it('loads enabled local department options before class options', async () => {
    const payload = [
      {
        departmentName: '机械工程系',
        id: 'ORG0301',
        isEnabled: true,
        shortName: '机械',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      departments: payload,
    });

    await expect(listLocalDepartmentOptions()).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentCourseResultsPullDepartments'),
      {
        isEnabled: true,
        limit: 500,
      },
    );
  });

  it('requests class student course results with the documented mutation shape', async () => {
    const payload = {
      cacheHitStudentCount: 0,
      classCode: '1021904',
      className: '19机电一体化4班',
      expiresAt: '2026-06-13T10:20:00.000Z',
      failedStudentCount: 0,
      failures: [],
      items: [],
      rowCount: 0,
      sessionStrategy: 'REUSED',
      studentCount: 2,
      upstreamFetchedStudentCount: 2,
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchClassStudentCourseResults: payload,
    });

    await expect(
      fetchClassStudentCourseResults({
        classCode: ' 1021904 ',
        refreshMode: 'REFRESH',
        schoolYear: ' 2024 ',
        sessionToken: ' rolling-token-001 ',
        studentNumbers: [' 219010401 ', '219010402'],
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('FetchClassStudentCourseResults');
    expect(query).toContain('fetchClassStudentCourseResults');
    expect(query).toContain('studentNumber');
    expect(query).toContain('periodicFinalTotalScore');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('FetchClassStudentCourseResults'),
      {
        input: {
          classCode: '1021904',
          refreshMode: 'REFRESH',
          schoolYear: '2024',
          sessionToken: 'rolling-token-001',
          studentNumbers: ['219010401', '219010402'],
        },
      },
      {
        logoutOnRetryAuthFailure: false,
      },
    );
  });
});
