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
import { requestAcademicWorkloadDeductionSummary } from './academic-workload-deduction-summary-api';

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

  it('requests academic workload deduction summary with normalized filters', async () => {
    const summary = {
      departmentSummaries: [
        {
          addedHours: '0',
          baselineHours: '32',
          deductedHours: '4',
          itemCount: 1,
          staffCount: 1,
          workloadDepartmentId: 'D-01',
          workloadDepartmentName: '计算机系',
        },
      ],
      invalidReason: null,
      isComplete: true,
      isValid: true,
      items: [
        {
          addedHours: '0',
          adjustmentDates: ['2026-04-06'],
          baselineHours: '32',
          baselineTeachingWeekCount: 16,
          baselineWeeklyHours: '2',
          courseCategory: '必修',
          courseName: '语文',
          deductedHours: '4',
          deductionReasonSummaries: [
            {
              dateSummaries: [{ date: '2026-04-06', deductedHours: '2' }],
              deductedHours: '2',
              sourceEventType: 'HOLIDAY',
            },
          ],
          staffId: 'T-001',
          staffName: '王老师',
          teacherEngagementType: 'FULL_TIME_TEACHER',
          teachingClassName: '高一 1 班',
          workloadDepartmentId: 'D-01',
          workloadDepartmentName: '计算机系',
        },
      ],
      total: {
        addedHours: '0',
        baselineHours: '32',
        deductedHours: '4',
        itemCount: 1,
        staffCount: 1,
      },
      truncationReason: null,
    };

    executeGraphQLMock.mockResolvedValueOnce({
      getAcademicWorkloadDeductionSummary: summary,
    });

    await expect(
      requestAcademicWorkloadDeductionSummary({
        endDate: ' 2026-06-21 ',
        semesterId: 202602,
        startDate: ' 2026-03-02 ',
        teacherEngagementType: 'FULL_TIME_TEACHER',
        workloadDepartmentId: ' D-01 ',
      }),
    ).resolves.toEqual(summary);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query AcademicWorkloadDeductionSummary'),
      {
        endDate: '2026-06-21',
        semesterId: 202602,
        startDate: '2026-03-02',
        teacherEngagementType: 'FULL_TIME_TEACHER',
        workloadDepartmentId: 'D-01',
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('getAcademicWorkloadDeductionSummary');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('deductionReasonSummaries');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('departmentSummaries');
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

  it('prefers GraphQL ingress error messages for deduction summary failures', async () => {
    const ingressError = {
      graphqlErrors: [
        {
          extensions: {
            errorMessage: '当前学期尚未生成扣课汇总。',
          },
        },
      ],
      userMessage: '统一错误提示',
    };

    executeGraphQLMock.mockRejectedValueOnce(ingressError);
    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    await expect(
      requestAcademicWorkloadDeductionSummary({
        semesterId: 202602,
      }),
    ).rejects.toThrow('当前学期尚未生成扣课汇总。');
  });
});
