// src/features/class-affairs-course-results/application/course-grade-refresh.ts

export type CourseGradeRefreshScope = 'SELECTED_TERM' | 'ALL_TERMS';

export type CourseGradeRefreshRequest = {
  classId: string;
  mutationSemesterId: number | null;
  returnSemesterId: number | null;
  scope: CourseGradeRefreshScope;
};

export type CourseGradeRefreshFeedback = {
  description: string;
  failures: Array<{
    message: string;
    studentNumber: string;
  }>;
  title: string;
  type: 'success' | 'warning';
};

export function buildCourseGradeRefreshRequest(input: {
  classId: string;
  scope: CourseGradeRefreshScope;
  selectedSemesterId: number | null;
}): CourseGradeRefreshRequest {
  return {
    classId: input.classId,
    mutationSemesterId: input.scope === 'SELECTED_TERM' ? input.selectedSemesterId : null,
    returnSemesterId: input.selectedSemesterId,
    scope: input.scope,
  };
}

export function resolveCourseGradeRefreshFeedback(input: {
  failedStudentCount: number;
  failures: Array<{
    message: string;
    studentNumber: string;
  }>;
  rowCount: number;
  status: 'REFRESHED' | 'PARTIAL';
  studentCount: number;
}): CourseGradeRefreshFeedback {
  if (input.status === 'PARTIAL') {
    return {
      description: `已处理 ${input.studentCount} 名学生，共获取 ${input.rowCount} 行成绩；${input.failedStudentCount} 名学生同步失败。`,
      failures: input.failures,
      title: '成绩同步部分完成',
      type: 'warning',
    };
  }

  return {
    description: `已同步 ${input.studentCount} 名学生，共获取 ${input.rowCount} 行成绩。`,
    failures: [],
    title: '成绩同步完成',
    type: 'success',
  };
}
