// src/features/academic-workload/infrastructure/academic-workload-api.spec.ts
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
  requestAcademicWorkloadDepartmentOptions,
  requestAcademicWorkloadReport,
} from './academic-workload-api';

describe('academic-workload api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('requests academic workload report with normalized filters and backend totals', async () => {
    const report = {
      invalidReason: null,
      isComplete: true,
      isValid: true,
      items: [
        {
          coefficient: '1.00',
          courseName: '语文',
          hours: '32',
          staffId: 'T-001',
          staffName: '王老师',
          sstsCourseId: 'C-001',
          sstsTeachingClassId: 'TC-001',
          teacherEngagementType: 'FULL_TIME_TEACHER',
          teachingClassName: '高一 1 班',
          weekCount: 16,
          weeklyHours: '2',
        },
      ],
      total: {
        hours: '32',
        itemCount: 1,
        staffCount: 1,
      },
      truncationReason: null,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      getAcademicWorkloadReport: report,
    });

    await expect(
      requestAcademicWorkloadReport({
        endDate: ' 2026-06-21 ',
        semesterId: 202602,
        startDate: ' 2026-03-02 ',
        teacherEngagementType: 'FULL_TIME_TEACHER',
        workloadDepartmentId: ' D-01 ',
      }),
    ).resolves.toEqual(report);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query GetAcademicWorkloadReport'),
      {
        endDate: '2026-06-21',
        semesterId: 202602,
        startDate: '2026-03-02',
        teacherEngagementType: 'FULL_TIME_TEACHER',
        workloadDepartmentId: 'D-01',
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('getAcademicWorkloadReport');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('weeklyHours');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('total');
  });

  it('loads enabled workload department options', async () => {
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

    await expect(requestAcademicWorkloadDepartmentOptions()).resolves.toEqual([
      {
        departmentName: '计算机系',
        id: 'D-01',
        isEnabled: true,
        shortName: '计科',
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query AcademicWorkloadDepartmentOptions'),
      { isEnabled: true, limit: 500 },
    );
  });

  it('prefers GraphQL ingress error messages for report failures', async () => {
    const ingressError = {
      graphqlErrors: [
        {
          extensions: {
            errorMessage: '当前学期尚未同步工作量数据。',
          },
        },
      ],
      userMessage: '统一错误提示',
    };

    executeGraphQLMock.mockRejectedValueOnce(ingressError);
    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    await expect(
      requestAcademicWorkloadReport({
        semesterId: 202602,
      }),
    ).rejects.toThrow('当前学期尚未同步工作量数据。');
  });
});
