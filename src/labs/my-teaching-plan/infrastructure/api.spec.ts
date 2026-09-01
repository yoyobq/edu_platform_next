import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: () => false,
}));

import {
  requestManagedTeachingPlan,
  requestManagedTeachingPlanTeacherOptions,
  requestMyTeachingPlan,
  requestMyTeachingPlanAcademicSemesters,
} from './api';

describe('my teaching plan lab api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('读取可见学期并保留完整学期记录', async () => {
    const semesters = [{ id: 8, isCurrent: true, name: '2026 秋季学期' }];
    executeGraphQLMock.mockResolvedValue({ academicSemesters: semesters });

    await expect(requestMyTeachingPlanAcademicSemesters()).resolves.toBe(semesters);
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({ isVisible: true, limit: 500 });
  });

  it('普通教师使用本人 occurrence query', async () => {
    const envelope = { items: [], isValid: true, isComplete: true };
    executeGraphQLMock.mockResolvedValue({
      listMyAcademicSemesterPlannedTimetable: envelope,
    });

    await expect(requestMyTeachingPlan(8)).resolves.toBe(envelope);
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain(
      'listMyAcademicSemesterPlannedTimetable',
    );
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({ semesterId: 8 });
  });

  it('管理者使用带目标 staffId 的终验 query', async () => {
    const envelope = { items: [], isValid: true, isComplete: true };
    executeGraphQLMock.mockResolvedValue({
      listManagedAcademicSemesterPlannedTimetable: envelope,
    });

    await expect(requestManagedTeachingPlan({ semesterId: 8, staffId: 'T001' })).resolves.toBe(
      envelope,
    );
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain(
      'listManagedAcademicSemesterPlannedTimetable',
    );
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({ semesterId: 8, staffId: 'T001' });
  });

  it('教师候选 trim 关键字并使用默认上限', async () => {
    const items = [{ staffId: 'T001', staffName: '张老师' }];
    executeGraphQLMock.mockResolvedValue({
      listManagedAcademicSemesterPlannedTimetableTeacherOptions: { items },
    });

    await expect(
      requestManagedTeachingPlanTeacherOptions({ semesterId: 8, keyword: ' 张 ' }),
    ).resolves.toBe(items);
    expect(executeGraphQLMock.mock.calls[0]?.[1]).toEqual({
      semesterId: 8,
      keyword: '张',
      limit: 20,
    });
  });
});
