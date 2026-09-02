// src/features/academic-teaching-plan/application/teaching-plan-projection.ts

import type { TeachingPlanCalcEffect, TeachingPlanOccurrence } from '../types';

export type TeachingPlanDateGroup = {
  readonly date: string;
  readonly monthKey: string;
  readonly occurrences: readonly TeachingPlanOccurrence[];
  readonly physicalDayOfWeek: number;
  readonly weekIndex: number;
};

export type TeachingPlanMonthGroup = {
  readonly key: string;
  readonly label: string;
  readonly dates: readonly TeachingPlanDateGroup[];
};

export type TeachingPlanCourseProjection = {
  readonly adjustmentOccurrences: readonly TeachingPlanOccurrence[];
  readonly classroomName: string | null;
  readonly courseCategory: string | null;
  readonly courseName: string;
  readonly dateCount: number;
  readonly effectiveOccurrenceCount: number;
  readonly months: readonly TeachingPlanMonthGroup[];
  readonly scheduleId: number;
  readonly teachingClassName: string;
};

export type TeachingPlanProjection = {
  readonly adjustmentOccurrenceCount: number;
  readonly courses: readonly TeachingPlanCourseProjection[];
  readonly dateCount: number;
  readonly effectiveOccurrenceCount: number;
};

export type CourseCategoryPresentation = {
  readonly kind: 'integrated' | 'neutral' | 'practice' | 'theory';
  readonly label: string;
};

const CALC_EFFECT_LABELS: Readonly<Record<TeachingPlanCalcEffect, string>> = {
  CANCEL: '停课',
  MAKEUP: '补课',
  NORMAL: '常规',
  REPEAT: '重复教学',
  SWAP_IN: '调入',
  SWAP_OUT: '调出',
};

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function buildTeachingPlanProjection(
  items: readonly TeachingPlanOccurrence[],
): TeachingPlanProjection {
  const courseItems = new Map<number, TeachingPlanOccurrence[]>();

  for (const item of [...items].sort(compareOccurrences)) {
    const current = courseItems.get(item.scheduleId) ?? [];
    current.push(item);
    courseItems.set(item.scheduleId, current);
  }

  const courses = Array.from(courseItems.entries())
    .map(([scheduleId, occurrences]) => buildCourseProjection(scheduleId, occurrences))
    .sort(compareCourses);
  const effectiveOccurrences = items.filter((item) => item.isEffective);

  return {
    adjustmentOccurrenceCount: items.length - effectiveOccurrences.length,
    courses,
    dateCount: new Set(effectiveOccurrences.map((item) => item.date)).size,
    effectiveOccurrenceCount: effectiveOccurrences.length,
  };
}

export function resolveCourseCategoryPresentation(
  value: string | null | undefined,
): CourseCategoryPresentation {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'THEORY' || normalized === '1' || value?.trim() === '理论课') {
    return { kind: 'theory', label: '理论课' };
  }
  if (normalized === 'PRACTICE' || normalized === '2' || value?.trim() === '实践课') {
    return { kind: 'practice', label: '实践课' };
  }
  if (normalized === 'INTEGRATED' || normalized === '3' || value?.trim() === '一体化') {
    return { kind: 'integrated', label: '一体化' };
  }

  return { kind: 'neutral', label: value?.trim() || '未分类' };
}

export function formatTeachingPlanBusinessDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

  if (!match) {
    return value;
  }

  return `${Number(match[2])}月${Number(match[3])}日`;
}

export function formatTeachingPlanWeekday(value: number) {
  return WEEKDAY_LABELS[value - 1] ?? `周${value}`;
}

export function formatTeachingPlanCalcEffect(value: TeachingPlanCalcEffect) {
  return CALC_EFFECT_LABELS[value];
}

function buildCourseProjection(
  scheduleId: number,
  occurrences: readonly TeachingPlanOccurrence[],
): TeachingPlanCourseProjection {
  const first = occurrences[0];
  const effectiveOccurrences = occurrences.filter((item) => item.isEffective);
  const adjustmentOccurrences = occurrences.filter((item) => !item.isEffective);
  const dateGroups = groupEffectiveOccurrencesByDate(effectiveOccurrences);
  const months = new Map<string, TeachingPlanDateGroup[]>();

  for (const dateGroup of dateGroups) {
    const current = months.get(dateGroup.monthKey) ?? [];
    current.push(dateGroup);
    months.set(dateGroup.monthKey, current);
  }

  return {
    adjustmentOccurrences,
    classroomName: first?.classroomName?.trim() || null,
    courseCategory: first?.courseCategory ?? null,
    courseName: first?.courseName?.trim() || '未命名课程',
    dateCount: dateGroups.length,
    effectiveOccurrenceCount: effectiveOccurrences.length,
    months: Array.from(months.entries()).map(([key, dates]) => ({
      key,
      label: formatMonthLabel(key),
      dates,
    })),
    scheduleId,
    teachingClassName: first?.teachingClassName.trim() || '未命名教学班',
  };
}

function groupEffectiveOccurrencesByDate(
  occurrences: readonly TeachingPlanOccurrence[],
): TeachingPlanDateGroup[] {
  const groups = new Map<string, TeachingPlanOccurrence[]>();

  for (const occurrence of occurrences) {
    const current = groups.get(occurrence.date) ?? [];
    current.push(occurrence);
    groups.set(occurrence.date, current);
  }

  return Array.from(groups.entries()).map(([date, dateOccurrences]) => ({
    date,
    monthKey: date.slice(0, 7),
    occurrences: dateOccurrences,
    physicalDayOfWeek: dateOccurrences[0]?.physicalDayOfWeek ?? 0,
    weekIndex: dateOccurrences[0]?.weekIndex ?? 0,
  }));
}

function compareOccurrences(left: TeachingPlanOccurrence, right: TeachingPlanOccurrence) {
  return (
    left.date.localeCompare(right.date) ||
    left.periodStart - right.periodStart ||
    left.periodEnd - right.periodEnd ||
    left.slotId - right.slotId
  );
}

function compareCourses(left: TeachingPlanCourseProjection, right: TeachingPlanCourseProjection) {
  const leftDate = left.months[0]?.dates[0]?.date ?? left.adjustmentOccurrences[0]?.date ?? '';
  const rightDate = right.months[0]?.dates[0]?.date ?? right.adjustmentOccurrences[0]?.date ?? '';

  return (
    leftDate.localeCompare(rightDate) ||
    left.courseName.localeCompare(right.courseName, 'zh-CN') ||
    left.teachingClassName.localeCompare(right.teachingClassName, 'zh-CN') ||
    left.scheduleId - right.scheduleId
  );
}

function formatMonthLabel(value: string) {
  const match = /^(\d{4})-(\d{2})$/u.exec(value);

  return match ? `${match[1]}年${Number(match[2])}月` : value;
}
