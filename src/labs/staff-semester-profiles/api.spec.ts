import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(() => false),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import { requestStaffSemesterProfiles } from './api';

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
        keyword: ' 张 ',
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
        keyword: '张',
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
      keyword: undefined,
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
});
