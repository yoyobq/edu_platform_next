// src/features/academic-workload/application/teacher-engagement.spec.ts
import { describe, expect, it } from 'vitest';

import {
  ACADEMIC_WORKLOAD_DEDUCTION_SUMMARY_ENGAGEMENT_TABS,
  ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER,
  ACADEMIC_WORKLOAD_REPORT_ENGAGEMENT_TABS,
  getAcademicWorkloadEngagementLabel,
} from './teacher-engagement';

describe('academic workload teacher engagement helpers', () => {
  it('keeps report and deduction summary labels aligned for formal tabs', () => {
    expect(getAcademicWorkloadEngagementLabel('ALL')).toBe('全部教师');
    expect(ACADEMIC_WORKLOAD_REPORT_ENGAGEMENT_TABS.map((item) => [item.key, item.label])).toEqual([
      ['ALL', '全部教师'],
      ['FULL_TIME_TEACHER', '专任教师'],
      ['ADMINISTRATIVE_TEACHING', '行政兼课'],
      ['PUBLIC_WELFARE_POST', '公益性岗位'],
      ['EXTERNAL_TEACHER', '外聘教师'],
    ]);
    expect(
      ACADEMIC_WORKLOAD_DEDUCTION_SUMMARY_ENGAGEMENT_TABS.filter((item) => !item.hidden).map(
        (item) => [item.key, item.label],
      ),
    ).toEqual([
      ['ALL', '全部教师'],
      ['FULL_TIME_TEACHER', '专任教师'],
      ['ADMINISTRATIVE_TEACHING', '行政兼课'],
      ['PUBLIC_WELFARE_POST', '公益性岗位'],
    ]);
  });

  it('keeps full-time teachers before administrative teaching in summary sorting', () => {
    expect(ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER.FULL_TIME_TEACHER).toBeLessThan(
      ACADEMIC_WORKLOAD_ENGAGEMENT_ORDER.ADMINISTRATIVE_TEACHING,
    );
  });
});
