// src/features/class-affairs-course-results/infrastructure/class-affairs-course-results-api.spec.ts

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

vi.mock('@/shared/graphql', () => ({ executeGraphQL: executeGraphQLMock }));

import {
  getClassCourseGradeWorkspace,
  refreshClassCourseGrades,
} from './class-affairs-course-results-api';

describe('class affairs course grade workspace api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
  });

  it('queries one backend-owned workspace and requests the score matrix', async () => {
    const payload = { classOptions: [], status: 'NO_CLASSES', view: null };
    executeGraphQLMock.mockResolvedValueOnce({ classCourseGradeWorkspace: payload });

    await expect(getClassCourseGradeWorkspace({})).resolves.toBe(payload);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query ClassCourseGradeWorkspace'),
      { input: {} },
    );
    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    expect(query).toContain('regularMatrix');
    expect(query).toContain('specialMatrix');
    expect(query).toContain('courseColumns');
    expect(query).toContain('includedInTermRoster');
  });

  it('refreshes a selected semester and sends the upstream token only to the mutation', async () => {
    const payload = {
      classCode: '2501',
      classId: 'C2501',
      scope: 'SELECTED_TERM',
      status: 'REFRESHED',
    };
    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshClassCourseGrades: payload,
    });

    await expect(
      refreshClassCourseGrades({
        classId: 'C2501',
        scope: 'SELECTED_TERM',
        semesterId: 202501,
        upstreamSessionToken: '{"token":"secret"}',
      }),
    ).resolves.toBe(payload);
    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation RefreshClassCourseGrades'),
      {
        input: {
          classId: 'C2501',
          scope: 'SELECTED_TERM',
          semesterId: 202501,
          sessionToken: '{"token":"secret"}',
        },
      },
    );
  });

  it('omits semesterId for an all-term refresh', async () => {
    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      refreshClassCourseGrades: { status: 'REFRESHED' },
    });

    await refreshClassCourseGrades({
      classId: 'C2501',
      scope: 'ALL_TERMS',
      semesterId: 202501,
      upstreamSessionToken: '{"token":"secret"}',
    });

    expect(executeUpstreamSessionGraphQLMock.mock.calls[0]?.[1]).toEqual({
      input: {
        classId: 'C2501',
        scope: 'ALL_TERMS',
        semesterId: undefined,
        sessionToken: '{"token":"secret"}',
      },
    });
  });
});
