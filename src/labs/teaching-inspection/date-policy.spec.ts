// src/labs/teaching-inspection/date-policy.spec.ts
import { describe, expect, it } from 'vitest';

import { inspectionDateProblem, suggestedInspectionDates } from './date-policy';
import type { Resource } from './model';
const resource: Resource = {
  resourceKey: 'course',
  sourceVersion: 'source',
  courseName: '课程',
  teacherNames: [],
  suggestedDates: ['2026-09-09', '2026-09-16', '2026-09-23'],
  earliestDate: null,
  latestDate: null,
  blockers: [],
  schedule: {
    records: [{ recordKey: 'first', checkDate: '2026-09-16', score: 100 }],
    historyState: 'VERIFIED',
    version: 1,
    dates: ['2026-09-10', '2026-09-20', '2026-10-01'],
    rounds: [],
  },
  status: {
    state: 'TRUSTED',
    upstreamCount: 1,
    observedAt: null,
    observationVersion: 1,
    effectiveCoveredCount: 1,
    rounds: [1, 2, 3].map((round) => ({
      round,
      dateEditable: round !== 1,
      dateBlockers: [],
      covered: round === 1,
      coverageBasis: [],
      canPrepare: false,
      blockers: [],
      retryAfter: null,
      retryWarningOperationId: null,
    })),
  },
};
describe('统一检查时间', () => {
  it('采用服务端周三建议时保留进度上游日期和其他类型锁定日期', () => {
    expect(suggestedInspectionDates(resource, 'PROGRESS')).toEqual([
      '2026-09-16',
      '2026-09-16',
      '2026-09-23',
    ]);
    expect(suggestedInspectionDates(resource, 'ASSIGNMENT')).toEqual([
      '2026-09-10',
      '2026-09-16',
      '2026-09-23',
    ]);
  });
  it('进度实际日期冲突阻断，调整后恢复；教案日期偏离交由历史关联处理', () => {
    const dates = resource.suggestedDates;
    expect(inspectionDateProblem(dates, resource, 'PROGRESS')).toContain('上游已提交日期');
    expect(
      inspectionDateProblem(['2026-09-16', '2026-09-17', '2026-09-23'], resource, 'PROGRESS'),
    ).toBeNull();
    expect(inspectionDateProblem(dates, resource, 'LESSON_PLAN')).toBeNull();
    expect(inspectionDateProblem(['', '', ''], resource, 'ASSIGNMENT')).toContain('补齐');
  });
});
