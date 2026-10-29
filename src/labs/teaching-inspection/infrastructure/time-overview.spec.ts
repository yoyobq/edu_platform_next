// src/labs/teaching-inspection/infrastructure/time-overview.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeGraphQL } from '@/shared/graphql';

import type { TimeWorkspace } from '../model';

import { loadTimeOverview } from './api';

vi.mock('@/shared/graphql', () => ({ executeGraphQL: vi.fn() }));
vi.mock('@/entities/upstream-session', () => ({ executeUpstreamSessionGraphQL: vi.fn() }));
function page(start: number, count: number): TimeWorkspace {
  return {
    total: 101,
    teachers: [],
    semesterTimePlan: {
      key: 'SEMESTER:1',
      version: 0,
      sourceVersion: 's',
      group: 'FULL',
      dates: [],
      suggestedDates: [],
      confirmed: false,
      fullSemester: true,
      canEdit: true,
      earliestDate: null,
      latestDate: null,
    },
    resources: Array.from({ length: count }, (_, i) => ({
      resourceKey: String(start + i),
      courseName: 'c',
      teacherNames: [],
      weeks: [],
      sourceVersion: 's',
      blockers: [],
      timePlan: {} as TimeWorkspace['semesterTimePlan'],
    })),
  };
}
beforeEach(() => vi.mocked(executeGraphQL).mockReset());
describe('权限范围内检查安排汇总', () => {
  it('汇总后一页，例外不因分页漏掉', async () => {
    vi.mocked(executeGraphQL)
      .mockResolvedValueOnce({ result: page(0, 100) })
      .mockResolvedValueOnce({ result: page(100, 1) });
    const result = await loadTimeOverview(21);
    expect(result.resources).toHaveLength(101);
    expect(result.resources.at(-1)?.resourceKey).toBe('100');
    expect(executeGraphQL).toHaveBeenNthCalledWith(2, expect.any(String), {
      input: { semesterId: 21, page: 2, limit: 100 },
    });
  });
  it('读取期间共用计划变化，不展示混合快照', async () => {
    const next = page(100, 1);
    next.semesterTimePlan.version = 2;
    vi.mocked(executeGraphQL)
      .mockResolvedValueOnce({ result: page(0, 100) })
      .mockResolvedValueOnce({ result: next });
    await expect(loadTimeOverview(21)).rejects.toThrow('读取期间发生变化');
  });
  it('分页重复或缺失时不显示错误的全学期数量', async () => {
    vi.mocked(executeGraphQL)
      .mockResolvedValueOnce({ result: page(0, 100) })
      .mockResolvedValueOnce({ result: page(0, 1) });
    await expect(loadTimeOverview(21)).rejects.toThrow('课程列表在读取期间发生变化');
  });
});
