// src/features/staff-semester-profiles/infrastructure/staff-semester-profiles-api.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(() => false),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import {
  backfillStaffSemesterProfilesFromCourseSchedules,
  requestStaffSemesterProfileDepartments,
  requestStaffSemesterProfileOptionRecords,
  requestStaffSemesterProfiles,
  updateStaffSemesterProfile,
} from './staff-semester-profiles-api';

describe('staff-semester-profiles api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('requests paginated staff semester profiles with normalized filters', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      staffSemesterProfiles: {
        current: 2,
        list: [
          {
            remarks: '骨干教师',
            semesterId: 202601,
            staffId: 'STAFF-001',
            staffName: '张老师',
            teacherEngagementType: 'FULL_TIME_TEACHER',
            teachingGroupId: 'TG-01',
            teachingGroupName: '软件工程教研组',
            updatedAt: '2026-05-02T00:00:00.000Z',
            workloadDepartmentId: 'D-01',
            workloadDepartmentName: '计算机系',
          },
        ],
        pageSize: 20,
        total: 1,
      },
    });

    await expect(
      requestStaffSemesterProfiles({
        limit: 20,
        page: 2,
        semesterId: 202601,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
        staffId: ' STAFF-001 ',
        teacherEngagementType: 'FULL_TIME_TEACHER',
        teachingGroupId: ' TG-01 ',
        workloadDepartmentId: ' D-01 ',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        current: 2,
        pageSize: 20,
        total: 1,
      }),
    );

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('staffSemesterProfiles'),
      {
        limit: 20,
        page: 2,
        semesterId: 202601,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
        staffId: 'STAFF-001',
        teacherEngagementType: 'FULL_TIME_TEACHER',
        teachingGroupId: 'TG-01',
        workloadDepartmentId: 'D-01',
      },
    );
  });

  it('applies default pagination and sort bounds', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      staffSemesterProfiles: {
        current: 1,
        list: [],
        pageSize: 100,
        total: 0,
      },
    });

    await requestStaffSemesterProfiles({
      limit: 500,
      page: 0,
      semesterId: 202601,
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      limit: 100,
      page: 1,
      semesterId: 202601,
      sortBy: 'staffId',
      sortOrder: 'ASC',
      staffId: undefined,
      teacherEngagementType: undefined,
      teachingGroupId: undefined,
      workloadDepartmentId: undefined,
    });
  });

  it('loads option records across staff semester profile pages', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      staffSemesterProfiles: {
        current: 1,
        list: [
          {
            remarks: null,
            semesterId: 202601,
            staffId: 'STAFF-001',
            staffName: '张老师',
            teacherEngagementType: 'FULL_TIME_TEACHER',
            teachingGroupId: 'TG-01',
            teachingGroupName: '软件工程教研组',
            updatedAt: '2026-05-02T00:00:00.000Z',
            workloadDepartmentId: 'D-01',
            workloadDepartmentName: '计算机系',
          },
        ],
        pageSize: 100,
        total: 2,
      },
    });
    executeGraphQLMock.mockResolvedValueOnce({
      staffSemesterProfiles: {
        current: 2,
        list: [
          {
            remarks: null,
            semesterId: 202601,
            staffId: 'STAFF-002',
            staffName: '李老师',
            teacherEngagementType: 'ADMINISTRATIVE_TEACHING',
            teachingGroupId: 'TG-02',
            teachingGroupName: '人工智能教研组',
            updatedAt: '2026-05-03T00:00:00.000Z',
            workloadDepartmentId: 'D-02',
            workloadDepartmentName: '人工智能系',
          },
        ],
        pageSize: 100,
        total: 2,
      },
    });

    await expect(requestStaffSemesterProfileOptionRecords({ semesterId: 202601 })).resolves.toEqual(
      [
        expect.objectContaining({
          staffId: 'STAFF-001',
        }),
        expect.objectContaining({
          staffId: 'STAFF-002',
        }),
      ],
    );

    expect(executeGraphQLMock).toHaveBeenNthCalledWith(1, expect.any(String), {
      limit: 100,
      page: 1,
      semesterId: 202601,
      sortBy: 'staffId',
      sortOrder: 'ASC',
      staffId: undefined,
      teacherEngagementType: undefined,
      teachingGroupId: undefined,
      workloadDepartmentId: undefined,
    });
    expect(executeGraphQLMock).toHaveBeenNthCalledWith(2, expect.any(String), {
      limit: 100,
      page: 2,
      semesterId: 202601,
      sortBy: 'staffId',
      sortOrder: 'ASC',
      staffId: undefined,
      teacherEngagementType: undefined,
      teachingGroupId: undefined,
      workloadDepartmentId: undefined,
    });
  });

  it('loads option records within workload department scope', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      staffSemesterProfiles: {
        current: 1,
        list: [],
        pageSize: 100,
        total: 0,
      },
    });

    await requestStaffSemesterProfileOptionRecords({
      semesterId: 202601,
      workloadDepartmentId: ' D-01 ',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      limit: 100,
      page: 1,
      semesterId: 202601,
      sortBy: 'staffId',
      sortOrder: 'ASC',
      staffId: undefined,
      teacherEngagementType: undefined,
      teachingGroupId: undefined,
      workloadDepartmentId: 'D-01',
    });
  });

  it('updates changed staff semester profile fields and preserves null clearing', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      updateStaffSemesterProfile: {
        createdAt: '2026-05-01T00:00:00.000Z',
        remarks: null,
        semesterId: 202601,
        staffId: 'STAFF-001',
        staffName: '张老师',
        teacherEngagementType: 'ADMINISTRATIVE_TEACHING',
        teachingGroupId: null,
        teachingGroupName: null,
        updatedAt: '2026-05-02T00:00:00.000Z',
        workloadDepartmentId: 'D-02',
        workloadDepartmentName: '人工智能系',
      },
    });

    await updateStaffSemesterProfile({
      semesterId: 202601,
      staffId: ' STAFF-001 ',
      teacherEngagementType: 'ADMINISTRATIVE_TEACHING',
      teachingGroupId: null,
      workloadDepartmentId: ' D-02 ',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('updateStaffSemesterProfile'),
      {
        input: {
          semesterId: 202601,
          staffId: 'STAFF-001',
          teacherEngagementType: 'ADMINISTRATIVE_TEACHING',
          teachingGroupId: null,
          workloadDepartmentId: 'D-02',
        },
      },
    );
  });

  it('loads enabled departments for backfill workload department selection', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      departments: [
        {
          departmentName: '计算机系',
          id: 'D-01',
          isEnabled: true,
          shortName: '计科',
        },
      ],
    });

    await expect(requestStaffSemesterProfileDepartments()).resolves.toEqual([
      {
        departmentName: '计算机系',
        id: 'D-01',
        isEnabled: true,
        shortName: '计科',
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query StaffSemesterProfileDepartments'),
      {
        isEnabled: true,
        limit: 500,
      },
    );
  });

  it('previews staff semester profile backfill from course schedules with normalized input', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      backfillStaffSemesterProfilesFromCourseSchedules: {
        alreadyExistingCount: 0,
        blockingCount: 0,
        candidateCount: 1,
        creatableCount: 1,
        createdCount: 0,
        dryRun: true,
        items: [
          {
            action: 'would_create',
            blockingReason: null,
            inheritedFromSemesterId: 202501,
            staffId: 'STAFF-001',
            staffName: '张老师',
            teacherEngagementType: 'FULL_TIME_TEACHER',
            teachingGroupId: 'TG-01',
          },
        ],
        semesterId: 202601,
        workloadDepartmentId: 'D-01',
      },
    });

    await expect(
      backfillStaffSemesterProfilesFromCourseSchedules({
        dryRun: true,
        semesterId: 202601,
        workloadDepartmentId: ' D-01 ',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        candidateCount: 1,
        dryRun: true,
      }),
    );

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('backfillStaffSemesterProfilesFromCourseSchedules'),
      {
        input: {
          dryRun: true,
          semesterId: 202601,
          workloadDepartmentId: 'D-01',
        },
      },
    );
  });

  it('executes staff semester profile backfill with dryRun false by default', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      backfillStaffSemesterProfilesFromCourseSchedules: {
        alreadyExistingCount: 0,
        blockingCount: 0,
        candidateCount: 1,
        creatableCount: 1,
        createdCount: 1,
        dryRun: false,
        items: [
          {
            action: 'created',
            blockingReason: null,
            inheritedFromSemesterId: null,
            staffId: 'STAFF-002',
            staffName: '李老师',
            teacherEngagementType: 'FULL_TIME_TEACHER',
            teachingGroupId: null,
          },
        ],
        semesterId: 202601,
        workloadDepartmentId: 'D-01',
      },
    });

    await backfillStaffSemesterProfilesFromCourseSchedules({
      semesterId: 202601,
      workloadDepartmentId: 'D-01',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      input: {
        dryRun: false,
        semesterId: 202601,
        workloadDepartmentId: 'D-01',
      },
    });
  });
});
