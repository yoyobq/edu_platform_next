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

import {
  dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans,
  fetchCourseScheduleSyncDepartmentOptions,
} from './api';

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

  it('previews course schedule sync through the independent dry-run mutation', async () => {
    const dryRunResult = {
      createdCount: 1,
      dryRun: true,
      failedCount: 0,
      failures: [],
      fetchedCount: 2,
      items: [
        {
          action: 'created',
          scheduleId: null,
          sstsCourseId: 'C-001',
          sstsTeachingClassId: 'TC-001',
        },
        {
          action: 'updated',
          scheduleId: 1001,
          sstsCourseId: 'C-002',
          sstsTeachingClassId: 'TC-002',
        },
      ],
      previewedCount: 2,
      semesterId: 3,
      updatedCount: 1,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans: dryRunResult,
    });

    await expect(
      dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans({
        departmentId: ' ORG0302 ',
        reviewStatus: 'APPROVED',
        schoolYear: ' 2025 ',
        semester: ' 1 ',
        teacherId: ' ',
        upstreamSessionToken: 'token-1',
      }),
    ).resolves.toEqual(dryRunResult);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation DryRunSyncCourseSchedules'),
      {
        input: {
          departmentId: 'ORG0302',
          reviewStatus: 'APPROVED',
          schoolYear: '2025',
          semester: '1',
          teacherId: undefined,
          upstreamSessionToken: 'token-1',
        },
      },
      {
        logoutOnRetryAuthFailure: false,
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain(
      'dryRunSyncCourseSchedulesFromUpstreamDepartmentCurriculumPlans',
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('previewedCount');
  });
});
