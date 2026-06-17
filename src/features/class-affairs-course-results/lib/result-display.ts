// src/features/class-affairs-course-results/lib/result-display.ts

import type {
  ManagedCourseResultsDisplayReasonCode,
  ManagedCourseResultsItem,
  ManagedCourseResultsStudentStatus,
} from '../infrastructure/class-affairs-course-results-api';

export type CourseResultsDisplaySemester = {
  id: number;
  schoolYear: number;
  termNumber: number;
};

export type CourseResultsDisplayTerm = {
  schoolYear: number;
  termNumber: number;
};

export type CourseResultsDisplaySplitContext = {
  activeSemesterId: number | null;
  activeTerm?: CourseResultsDisplayTerm | null;
  semesters: readonly CourseResultsDisplaySemester[];
};

export const COURSE_RESULTS_REASON_LABELS: Record<ManagedCourseResultsDisplayReasonCode, string> = {
  CLASS_MEMBERSHIP_CORRECTION: '班级归属修正',
  DROPPED_CONFIRMED: '确认报到后退学',
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

const INCLUDE_REASON_CODES = new Set<ManagedCourseResultsDisplayReasonCode>([
  'REENROLLED_CONFIRMED',
  'RETAINED_GRADE_CONFIRMED',
  'TRANSFERRED_IN_CONFIRMED',
]);

const EXCLUDE_REASON_CODES = new Set<ManagedCourseResultsDisplayReasonCode>([
  'CLASS_MEMBERSHIP_CORRECTION',
  'TRANSFERRED_OUT_CONFIRMED',
  'UPSTREAM_ROSTER_ERROR_CONFIRMED',
]);

function resolveSemesterOrder(semester: CourseResultsDisplayTerm) {
  return semester.schoolYear * 10 + semester.termNumber;
}

function isActiveSemesterBeforeEffectiveSemester(
  context: CourseResultsDisplaySplitContext,
  effectiveSemesterId: number | null,
) {
  if (effectiveSemesterId === null) {
    return false;
  }

  const activeSemester =
    context.activeSemesterId !== null
      ? (context.semesters.find((semester) => semester.id === context.activeSemesterId) ??
        context.activeTerm ??
        null)
      : (context.activeTerm ?? null);
  const effectiveSemester = context.semesters.find(
    (semester) => semester.id === effectiveSemesterId,
  );

  if (!activeSemester || !effectiveSemester) {
    return false;
  }

  return resolveSemesterOrder(activeSemester) < resolveSemesterOrder(effectiveSemester);
}

function shouldDisplayEntryCaseInSpecialTable(
  item: Pick<ManagedCourseResultsItem, 'resultDisplayEffectiveSemesterId'>,
  context: CourseResultsDisplaySplitContext,
) {
  return isActiveSemesterBeforeEffectiveSemester(context, item.resultDisplayEffectiveSemesterId);
}

export function shouldDisplayCourseResultsItemInSpecialTable(
  item: Pick<
    ManagedCourseResultsItem,
    | 'resultDisplayDecisionOutcome'
    | 'resultDisplayEffectiveSemesterId'
    | 'resultDisplayReasonCode'
    | 'resultDisplayStatus'
    | 'studentStatus'
  >,
  context: CourseResultsDisplaySplitContext,
) {
  if (item.resultDisplayStatus !== 'SPECIAL_CASE') {
    return false;
  }

  if (
    item.resultDisplayReasonCode === 'DROPPED_CONFIRMED' &&
    isActiveSemesterBeforeEffectiveSemester(context, item.resultDisplayEffectiveSemesterId)
  ) {
    return false;
  }

  if (item.resultDisplayReasonCode === 'DROPPED_CONFIRMED') {
    return true;
  }

  if (
    item.resultDisplayReasonCode &&
    INCLUDE_REASON_CODES.has(item.resultDisplayReasonCode) &&
    shouldDisplayEntryCaseInSpecialTable(item, context)
  ) {
    return true;
  }

  if (item.resultDisplayDecisionOutcome === 'EXCLUDE') {
    return true;
  }

  if (item.resultDisplayDecisionOutcome === 'INCLUDE') {
    return false;
  }

  if (item.resultDisplayReasonCode && INCLUDE_REASON_CODES.has(item.resultDisplayReasonCode)) {
    return false;
  }

  if (item.resultDisplayReasonCode && EXCLUDE_REASON_CODES.has(item.resultDisplayReasonCode)) {
    return true;
  }

  return item.studentStatus === 'DROPPED' || item.studentStatus === 'SUSPENDED';
}

export function splitCourseResultsItemsForDisplay(
  items: readonly ManagedCourseResultsItem[],
  context: CourseResultsDisplaySplitContext,
) {
  const specialItems: ManagedCourseResultsItem[] = [];
  const regularItems: ManagedCourseResultsItem[] = [];

  for (const item of items) {
    if (shouldDisplayCourseResultsItemInSpecialTable(item, context)) {
      specialItems.push(item);
    } else {
      regularItems.push(item);
    }
  }

  return {
    regularItems,
    specialItems,
  };
}
