import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, requestAcademicSemestersMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  requestAcademicSemestersMock: vi.fn(),
}));

vi.mock('@/entities/academic-semester', () => ({
  requestAcademicSemesters: requestAcademicSemestersMock,
}));

vi.mock('@/entities/upstream-session', () => ({
  isExpiredUpstreamSessionError: vi.fn(() => false),
  readUpstreamGraphQLErrorDetail: vi.fn(() => null),
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import { fetchCourseScheduleSyncDepartmentOptions } from './api';

describe('course-schedule-sync api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    requestAcademicSemestersMock.mockReset();
  });

  it('loads department options through the shared departments query shape', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      departments: [
        {
          departmentName: '人工智能系',
          id: 'd-ai',
          isEnabled: true,
          shortName: 'AI',
        },
      ],
    });

    await expect(fetchCourseScheduleSyncDepartmentOptions()).resolves.toEqual([
      {
        departmentName: '人工智能系',
        id: 'd-ai',
        isEnabled: true,
        shortName: 'AI',
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query CourseScheduleSyncDepartments($limit: Int)'),
      { limit: 500 },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('isEnabled: $isEnabled');
  });
});
