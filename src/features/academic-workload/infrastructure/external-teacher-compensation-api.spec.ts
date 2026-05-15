// src/features/academic-workload/infrastructure/external-teacher-compensation-api.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(() => false),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import { requestAcademicAdjustedWorkloadReport } from './external-teacher-compensation-api';

describe('external teacher compensation api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('requests the adjusted workload report with normalized filters and backend totals', async () => {
    const report = {
      invalidReason: null,
      isComplete: true,
      isValid: true,
      items: [
        {
          actualHours: '70',
          addedHours: '2',
          adjustmentHours: '-2',
          budgetHours: '72',
          coefficient: '1',
          courseCategory: 'REQUIRED',
          courseName: '语文',
          deductedHours: '4',
          semesterId: 202602,
          sstsCourseId: 'C-001',
          sstsTeachingClassId: 'TC-001',
          staffId: 'T-001',
          staffName: '王老师',
          teacherEngagementType: 'FULL_TIME_TEACHER',
          teachingClassName: '高一 1 班',
          weekCount: 18,
          weeklyHours: '4',
          workloadDepartmentId: 'D-01',
          workloadDepartmentName: '计算机系',
        },
      ],
      total: {
        actualHours: '70',
        addedHours: '2',
        adjustmentHours: '-2',
        budgetHours: '72',
        deductedHours: '4',
        itemCount: 1,
        staffCount: 1,
      },
      truncationReason: null,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      getAcademicAdjustedWorkloadReport: report,
    });

    await expect(
      requestAcademicAdjustedWorkloadReport({
        endWeekIndex: 8,
        semesterId: 202602,
        startWeekIndex: 3,
        teacherEngagementType: 'FULL_TIME_TEACHER',
        workloadDepartmentId: ' D-01 ',
      }),
    ).resolves.toEqual(report);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query GetAcademicAdjustedWorkloadReport'),
      {
        endWeekIndex: 8,
        semesterId: 202602,
        startWeekIndex: 3,
        teacherEngagementType: 'FULL_TIME_TEACHER',
        workloadDepartmentId: 'D-01',
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('getAcademicAdjustedWorkloadReport');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('budgetHours');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('actualHours');
  });

  it('keeps a start-week-only request as a single-week backend request', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      getAcademicAdjustedWorkloadReport: {
        invalidReason: null,
        isComplete: true,
        isValid: true,
        items: [],
        total: {
          actualHours: '0',
          addedHours: '0',
          adjustmentHours: '0',
          budgetHours: '0',
          deductedHours: '0',
          itemCount: 0,
          staffCount: 0,
        },
        truncationReason: null,
      },
    });

    await requestAcademicAdjustedWorkloadReport({
      semesterId: 202602,
      startWeekIndex: 6,
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('GetAcademicAdjustedWorkloadReport'),
      {
        endWeekIndex: undefined,
        semesterId: 202602,
        startWeekIndex: 6,
        teacherEngagementType: undefined,
        workloadDepartmentId: undefined,
      },
    );
  });

  it('prefers GraphQL ingress error messages for report failures', async () => {
    const ingressError = {
      graphqlErrors: [
        {
          extensions: {
            errorMessage: '当前学期尚未生成调整后工作量报表。',
          },
        },
      ],
      userMessage: '统一错误提示',
    };

    executeGraphQLMock.mockRejectedValueOnce(ingressError);
    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    await expect(
      requestAcademicAdjustedWorkloadReport({
        semesterId: 202602,
      }),
    ).rejects.toThrow('当前学期尚未生成调整后工作量报表。');
  });
});
