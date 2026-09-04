// src/features/academic-split-joint-teaching/infrastructure/academic-split-joint-teaching-api.spec.ts
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
  requestAcademicSplitJointTeachingCandidates,
  setAcademicSplitJointTeachingConfirmation,
} from './academic-split-joint-teaching-api';

describe('academic split joint teaching api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('loads realtime candidate evidence from the backend', async () => {
    const candidate = {
      semesterId: 1,
      staffId: '2236',
      staffName: '杨燕',
      sstsCourseId: 'COURSE-1',
      courseName: '信息技术1',
      cohorts: [],
      originalBudgetHours: '112',
      semanticBudgetHours: '91.2',
      originalEffectiveHours: '112',
      semanticEffectiveHours: '91.2',
      confirmed: false,
      isActiveCandidate: true,
      invalidReason: null,
    };
    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicSplitJointTeachingCandidates: { items: [candidate] },
    });

    await expect(requestAcademicSplitJointTeachingCandidates(1)).resolves.toEqual([candidate]);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query ListAcademicSplitJointTeachingCandidates'),
      { semesterId: 1 },
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain('exceptionalWeekIndexes');
  });

  it('writes only the confirmation key and selected semantic mode', async () => {
    const input = {
      semesterId: 1,
      staffId: '2236',
      sstsCourseId: 'COURSE-1',
      confirmed: true,
    };
    executeGraphQLMock.mockResolvedValueOnce({
      setAcademicSplitJointTeachingConfirmation: input,
    });

    await expect(setAcademicSplitJointTeachingConfirmation(input)).resolves.toEqual(input);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation SetAcademicSplitJointTeachingConfirmation'),
      { input },
    );
  });
});
