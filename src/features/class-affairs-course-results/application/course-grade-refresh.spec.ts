// src/features/class-affairs-course-results/application/course-grade-refresh.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildCourseGradeRefreshRequest,
  resolveCourseGradeRefreshFeedback,
} from './course-grade-refresh';

describe('course grade refresh application policy', () => {
  it('omits the mutation semester for all-term refreshes but keeps the selected term for reload', () => {
    expect(
      buildCourseGradeRefreshRequest({
        classId: 'C2501',
        scope: 'ALL_TERMS',
        selectedSemesterId: 202401,
      }),
    ).toEqual({
      classId: 'C2501',
      mutationSemesterId: null,
      returnSemesterId: 202401,
      scope: 'ALL_TERMS',
    });
  });

  it('uses the selected semester for both mutation and reload in selected-term refreshes', () => {
    expect(
      buildCourseGradeRefreshRequest({
        classId: 'C2501',
        scope: 'SELECTED_TERM',
        selectedSemesterId: 202401,
      }),
    ).toEqual({
      classId: 'C2501',
      mutationSemesterId: 202401,
      returnSemesterId: 202401,
      scope: 'SELECTED_TERM',
    });
  });

  it('keeps partial failures in refresh feedback', () => {
    expect(
      resolveCourseGradeRefreshFeedback({
        failedStudentCount: 1,
        failures: [{ message: '上游暂无成绩', studentNumber: '324010112' }],
        rowCount: 8,
        status: 'PARTIAL',
        studentCount: 2,
      }),
    ).toEqual({
      description: '已处理 2 名学生，共获取 8 行成绩；1 名学生同步失败。',
      failures: [{ message: '上游暂无成绩', studentNumber: '324010112' }],
      title: '成绩同步部分完成',
      type: 'warning',
    });
  });

  it('returns concise success feedback without stale failures', () => {
    expect(
      resolveCourseGradeRefreshFeedback({
        failedStudentCount: 0,
        failures: [{ message: '不应保留', studentNumber: '324010112' }],
        rowCount: 12,
        status: 'REFRESHED',
        studentCount: 3,
      }),
    ).toEqual({
      description: '已同步 3 名学生，共获取 12 行成绩。',
      failures: [],
      title: '成绩同步完成',
      type: 'success',
    });
  });
});
