// src/labs/student-course-results-view/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/entities/upstream-session', () => ({
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  fetchClassStudentCourseResults,
  listLocalClassOptions,
  normalizeFetchClassStudentCourseResultsInput,
} from './api';

describe('student-course-results-view api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('builds cache-first input and omits all-school-year filters', () => {
    expect(
      normalizeFetchClassStudentCourseResultsInput({
        classCode: ' 1021904 ',
        schoolYear: ' ',
        semester: ' ',
        studentNumbers: [],
      }),
    ).toEqual({
      classCode: '1021904',
      refreshMode: 'CACHE_FIRST',
    });
  });

  it('keeps optional school year, semester and student numbers when provided', () => {
    expect(
      normalizeFetchClassStudentCourseResultsInput({
        classCode: '1021904',
        refreshMode: 'CACHE_FIRST',
        schoolYear: ' 2024 ',
        semester: ' 1 ',
        studentNumbers: [' 219010401 ', '219010401', '219010402'],
      }),
    ).toEqual({
      classCode: '1021904',
      refreshMode: 'CACHE_FIRST',
      schoolYear: '2024',
      semester: '1',
      studentNumbers: ['219010401', '219010402'],
    });
  });

  it('loads class options by department', async () => {
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

    await expect(listLocalClassOptions({ departmentId: ' ORG0301 ' })).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('StudentCourseResultsViewLocalClassOptions'),
      {
        input: {
          departmentId: 'ORG0301',
        },
      },
    );
  });

  it('requests cache-first results without sessionToken', async () => {
    const payload = {
      cacheHitStudentCount: 1,
      classCode: '1021904',
      className: '19机电一体化4班',
      failedStudentCount: 0,
      failures: [],
      items: [],
      rowCount: 0,
      studentCount: 1,
      upstreamFetchedStudentCount: 0,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      fetchClassStudentCourseResults: payload,
    });

    await expect(
      fetchClassStudentCourseResults({
        classCode: '1021904',
        schoolYear: '2024',
      }),
    ).resolves.toEqual(payload);

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('fetchClassStudentCourseResults');
    expect(query).not.toContain('upstreamSessionToken');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('FetchClassStudentCourseResults'),
      {
        input: {
          classCode: '1021904',
          refreshMode: 'CACHE_FIRST',
          schoolYear: '2024',
        },
      },
    );
  });
});
