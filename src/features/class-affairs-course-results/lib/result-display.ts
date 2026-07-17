// src/features/class-affairs-course-results/lib/result-display.ts

import type {
  ManagedCourseResultsDisplayReasonCode,
  ManagedCourseResultsStudentStatus,
} from '../infrastructure/class-affairs-course-results-api';

export const COURSE_RESULTS_REASON_LABELS: Record<ManagedCourseResultsDisplayReasonCode, string> = {
  CLASS_MEMBERSHIP_CORRECTION: '班级归属修正',
  DROPPED_CONFIRMED: '确认报到后退学',
  NOT_CHECKED_IN_CONFIRMED: '确认未报到且不再报到',
  REENROLLED_CONFIRMED: '确认复学转入当前班',
  RETAINED_GRADE_CONFIRMED: '确认留级至当前班',
  TRANSFERRED_IN_CONFIRMED: '确认平级转入当前班',
  TRANSFERRED_OUT_CONFIRMED: '确认转出',
  UPSTREAM_ROSTER_ERROR_CONFIRMED: '确认 upstream 名册异常',
};

export const COURSE_RESULTS_STUDENT_STATUS_LABELS: Record<
  ManagedCourseResultsStudentStatus,
  string
> = {
  DROPPED: '退学',
  ENROLLED: '在读',
  GRADUATED: '已毕业',
  NOT_CHECKED_IN: '确认未报到',
  OFF_CAMPUS_INTERNSHIP: '下厂/校外实习',
  PRE_REGISTERED: '预报到',
  SUSPENDED: '暂离',
};
