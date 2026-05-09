// src/features/academic-integrated-plan-corrections/infrastructure/academic-integrated-plan-corrections-api.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isExpiredUpstreamSessionErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isExpiredUpstreamSessionErrorMock: vi.fn(() => false),
}));

vi.mock('@/entities/upstream-session', () => ({
  isExpiredUpstreamSessionError: isExpiredUpstreamSessionErrorMock,
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  listIntegratedPlanCorrectionSuggestions,
  listMyIntegratedPlanCorrectionSuggestions,
} from './academic-integrated-plan-corrections-api';

describe('integrated-plan-corrections api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReset();
    isExpiredUpstreamSessionErrorMock.mockReturnValue(false);
  });

  it('requests repair groups, suggestions, debug items and rolling token fields', async () => {
    const payload = {
      expiresAt: '2026-05-08T10:00:00.000Z',
      items: [
        {
          alignmentStatus: 'CURRENT_ONLY',
          blockingIssue: null,
          cascadeFromGroupRoot: false,
          courseName: '一体化课程',
          currentOriginalIndex: 8,
          currentPlan: {
            learningSessionContent: '环节',
            learningSessionNo: 1,
            learningTaskName: '任务',
            learningTaskNo: 1,
            lessonHours: 4,
            teachingUnitName: '单元',
            teachingUnitNo: 1,
            weekNumber: 8,
          },
          diffs: ['WEEK_NUMBER_MISMATCH'],
          expectedIndex: null,
          lecturePlanDetailId: 'DETAIL-001',
          lecturePlanId: 'PLAN-001',
          repairGroupId: 'GROUP-001',
          suggested: {
            firstWeekNumber: 9,
            lessonHours: 4,
            suggestedOccurrences: [],
          },
          teachingClassId: 'CLASS-001',
          teachingClassName: '一体化 1 班',
        },
      ],
      repairGroups: [
        {
          affectedDetailIds: ['DETAIL-001'],
          blockingIssue: null,
          diffs: ['WEEK_NUMBER_MISMATCH'],
          endOriginalIndex: 1,
          id: 'GROUP-001',
          lecturePlanId: 'PLAN-001',
          rootLecturePlanDetailId: 'DETAIL-001',
          startOriginalIndex: 1,
          suggestions: [],
          teachingClassId: 'CLASS-001',
        },
      ],
      summary: {
        affectedDetailCount: 1,
        blockingIssueCount: 0,
        detailCount: 12,
        planCount: 1,
        repairGroupCount: 1,
      },
      teachingClassGroups: [
        {
          courseName: '一体化课程',
          endOriginalIndex: 8,
          id: 'PLAN-001:CLASS-001',
          itemOriginalIndexes: [8],
          lecturePlanId: 'PLAN-001',
          repairGroupIds: ['GROUP-001'],
          startOriginalIndex: 8,
          teachingClassId: 'CLASS-001',
          teachingClassName: '一体化 1 班',
        },
      ],
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicIntegratedPlanCorrectionSuggestions: payload,
    });

    await expect(
      listIntegratedPlanCorrectionSuggestions({
        lecturePlanId: ' PLAN-001 ',
        semesterId: 202601,
        staffId: ' STAFF-001 ',
        teachingClassId: ' CLASS-001 ',
        upstreamSessionToken: ' token-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('listAcademicIntegratedPlanCorrectionSuggestions'),
      {
        lecturePlanId: 'PLAN-001',
        semesterId: 202601,
        staffId: 'STAFF-001',
        teachingClassId: 'CLASS-001',
        upstreamSessionToken: 'token-001',
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('repairGroups');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('teachingClassGroups');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('itemOriginalIndexes');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('repairGroupIds');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('alignmentStatus');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('currentOriginalIndex');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('expectedIndex');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('suggestedOccurrences');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('items');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('upstreamSessionToken');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('expiresAt');
  });

  it('normalizes empty optional filters to undefined', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicIntegratedPlanCorrectionSuggestions: {
        expiresAt: null,
        items: [],
        repairGroups: [],
        summary: {
          affectedDetailCount: 0,
          blockingIssueCount: 0,
          detailCount: 0,
          planCount: 0,
          repairGroupCount: 0,
        },
        teachingClassGroups: [],
        upstreamSessionToken: null,
      },
    });

    await listIntegratedPlanCorrectionSuggestions({
      lecturePlanId: ' ',
      semesterId: 202601,
      staffId: 'STAFF-001',
      teachingClassId: ' ',
      upstreamSessionToken: 'token-001',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(expect.any(String), {
      lecturePlanId: undefined,
      semesterId: 202601,
      staffId: 'STAFF-001',
      teachingClassId: undefined,
      upstreamSessionToken: 'token-001',
    });
  });

  it('requests my correction suggestions without sending staffId', async () => {
    const payload = {
      expiresAt: null,
      items: [],
      repairGroups: [],
      summary: {
        affectedDetailCount: 0,
        blockingIssueCount: 0,
        detailCount: 0,
        planCount: 0,
        repairGroupCount: 0,
      },
      teachingClassGroups: [],
      upstreamSessionToken: 'rolling-token-002',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      listMyAcademicIntegratedPlanCorrectionSuggestions: payload,
    });

    await expect(
      listMyIntegratedPlanCorrectionSuggestions({
        semesterId: 202601,
        upstreamSessionToken: ' token-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('listMyAcademicIntegratedPlanCorrectionSuggestions'),
      {
        semesterId: 202601,
        upstreamSessionToken: 'token-001',
      },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('$staffId');
    expect(executeGraphQLMock.mock.calls[0]?.[0]).not.toContain('staffId:');
  });

  it('rejects required fields before requesting', async () => {
    await expect(
      listIntegratedPlanCorrectionSuggestions({
        semesterId: 202601,
        staffId: ' ',
        upstreamSessionToken: 'token-001',
      }),
    ).rejects.toThrow('staffId 为必填。');

    await expect(
      listIntegratedPlanCorrectionSuggestions({
        semesterId: 202601,
        staffId: 'STAFF-001',
        upstreamSessionToken: ' ',
      }),
    ).rejects.toThrow('upstreamSessionToken 为必填。');

    await expect(
      listMyIntegratedPlanCorrectionSuggestions({
        semesterId: 202601,
        upstreamSessionToken: ' ',
      }),
    ).rejects.toThrow('upstreamSessionToken 为必填。');

    expect(executeGraphQLMock).not.toHaveBeenCalled();
  });

  it('rethrows expired upstream session errors', async () => {
    const expiredError = new Error('expired');

    executeGraphQLMock.mockRejectedValueOnce(expiredError);
    isExpiredUpstreamSessionErrorMock.mockReturnValueOnce(true);

    await expect(
      listIntegratedPlanCorrectionSuggestions({
        semesterId: 202601,
        staffId: 'STAFF-001',
        upstreamSessionToken: 'token-001',
      }),
    ).rejects.toBe(expiredError);
  });
});
