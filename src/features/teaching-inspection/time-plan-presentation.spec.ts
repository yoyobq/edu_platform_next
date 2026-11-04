// src/features/teaching-inspection/time-plan-presentation.spec.ts
import { describe, expect, it } from 'vitest';

import type { TimeWorkspace } from './model';
import { needsCourseAttention } from './time-plan-presentation';

function fixture() {
  const plan = {
    group: 'FULL' as const,
    confirmed: false,
    version: 0,
    dates: [],
    suggestedDates: [],
    key: 'SEMESTER:1',
    sourceVersion: 's',
    fullSemester: true,
    canEdit: true,
    earliestDate: null,
    latestDate: null,
  };
  const row = {
    resourceKey: 'c',
    courseName: 'c',
    teacherNames: [],
    weeks: [2, 17],
    sourceVersion: 's',
    blockers: [] as string[],
    timePlan: plan,
    grouping: {
      group: 'FULL' as const,
      suggestedGroup: 'FULL' as const,
      start: 2,
      end: 17,
      needsReview: true,
      reason: '等待统一确认',
      preserved: false,
    },
  };
  const work: TimeWorkspace = { semesterTimePlan: plan, total: 1, teachers: [], resources: [row] };
  return { row, work };
}
describe('课程待处理清单', () => {
  it('等待统一日期确认不当作逐课例外', () => {
    const { row, work } = fixture();
    expect(needsCourseAttention(row, work)).toBe(false);
  });
  it('共用规则已确认但课程日期越界，必须列入', () => {
    const { row, work } = fixture();
    work.semesterTimePlan.confirmed = true;
    expect(needsCourseAttention(row, work)).toBe(true);
  });
  it('课表缺失即使等待统一确认也不能隐藏', () => {
    const { row, work } = fixture();
    row.blockers = ['SOURCE_INVALID'];
    expect(needsCourseAttention(row, work)).toBe(true);
  });
  it('未匹配课程需要处理，已确认独立课程正常', () => {
    const { row, work } = fixture();
    const independent = {
      ...row,
      grouping: undefined,
      timePlan: { ...row.timePlan, group: 'CUSTOM' as const },
    };
    expect(needsCourseAttention(independent, work)).toBe(true);
    independent.timePlan.confirmed = true;
    expect(needsCourseAttention(independent, work)).toBe(false);
  });
});
