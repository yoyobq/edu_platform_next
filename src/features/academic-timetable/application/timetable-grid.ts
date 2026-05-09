import type { AcademicTimetableGridItem } from '../infrastructure/academic-timetable-api';

export const MAX_TIMETABLE_PERIOD_COUNT = 12;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_WEEK = 7 * MILLISECONDS_PER_DAY;

type TeachingWeekSemester = {
  endDate: string;
  firstTeachingDate: string;
  startDate: string;
};

type TeachingWeekCountSemester = {
  examStartDate: string;
  firstTeachingDate: string;
};

export type AcademicTeachingClassOptionLabelInput = {
  courseNames: readonly string[];
  sstsTeachingClassId: string;
  staffNames: readonly string[];
  teachingClassNames: readonly string[];
};

export type TeachingWeekDateRange = {
  endDate: string;
  startDate: string;
};

type TimetableSlotGroup<TItem extends AcademicTimetableGridItem> = {
  dayOfWeek: number;
  items: TItem[];
  key: string;
  periodEnd: number;
  periodStart: number;
};

export type TimetableSlotPlacement<TItem extends AcademicTimetableGridItem> =
  TimetableSlotGroup<TItem> & {
    laneCount: number;
    laneIndex: number;
  };

export type CourseCategoryMeta = {
  accentClassName: string;
  label: string;
  surfaceClassName: string;
};

const THEORY_COURSE_CATEGORY_META: CourseCategoryMeta = {
  accentClassName: 'academic-timetable-course-category-theory',
  label: '理论课',
  surfaceClassName: 'academic-timetable-course-surface-theory',
};

const PRACTICE_COURSE_CATEGORY_META: CourseCategoryMeta = {
  accentClassName: 'academic-timetable-course-category-practice',
  label: '实践课',
  surfaceClassName: 'academic-timetable-course-surface-practice',
};

const INTEGRATED_COURSE_CATEGORY_META: CourseCategoryMeta = {
  accentClassName: 'academic-timetable-course-category-integrated',
  label: '一体化',
  surfaceClassName: 'academic-timetable-course-surface-integrated',
};

const COURSE_CATEGORY_META = {
  '1': THEORY_COURSE_CATEGORY_META,
  '2': PRACTICE_COURSE_CATEGORY_META,
  '3': INTEGRATED_COURSE_CATEGORY_META,
  INTEGRATED: INTEGRATED_COURSE_CATEGORY_META,
  PRACTICE: PRACTICE_COURSE_CATEGORY_META,
  THEORY: THEORY_COURSE_CATEGORY_META,
  一体化: INTEGRATED_COURSE_CATEGORY_META,
  实践课: PRACTICE_COURSE_CATEGORY_META,
  理论课: THEORY_COURSE_CATEGORY_META,
} as const;

function parseIsoDateOnly(value: string) {
  const [datePart] = value.split('T');
  const [yearText, monthText, dayText] = datePart.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function normalizeDateOnly(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

function startOfTeachingWeek(value: Date) {
  const dayOfWeek = value.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  return new Date(value.getTime() - daysFromMonday * MILLISECONDS_PER_DAY);
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

function formatUtcDateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

function sortTimetableItems<TItem extends AcademicTimetableGridItem>(
  items: TItem[],
  getTieBreaker: (item: TItem) => string,
) {
  return [...items].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }

    if (left.periodStart !== right.periodStart) {
      return left.periodStart - right.periodStart;
    }

    if (left.periodEnd !== right.periodEnd) {
      return left.periodEnd - right.periodEnd;
    }

    return getTieBreaker(left).localeCompare(getTieBreaker(right), 'zh-CN');
  });
}

function groupTimetableItems<TItem extends AcademicTimetableGridItem>(
  items: TItem[],
  getTieBreaker: (item: TItem) => string,
) {
  const groups = new Map<string, TimetableSlotGroup<TItem>>();

  for (const item of sortTimetableItems(items, getTieBreaker)) {
    const key = `${item.dayOfWeek}:${item.periodStart}-${item.periodEnd}`;
    const currentGroup = groups.get(key);

    if (currentGroup) {
      currentGroup.items.push(item);
      continue;
    }

    groups.set(key, {
      dayOfWeek: item.dayOfWeek,
      items: [item],
      key,
      periodEnd: item.periodEnd,
      periodStart: item.periodStart,
    });
  }

  return [...groups.values()];
}

function buildClusterSlotPlacements<TItem extends AcademicTimetableGridItem>(
  groups: TimetableSlotGroup<TItem>[],
): TimetableSlotPlacement<TItem>[] {
  const lanePeriodEnds: number[] = [];
  const placements = groups.map((group) => {
    let laneIndex = lanePeriodEnds.findIndex((periodEnd) => group.periodStart > periodEnd);

    if (laneIndex === -1) {
      laneIndex = lanePeriodEnds.length;
      lanePeriodEnds.push(group.periodEnd);
    } else {
      lanePeriodEnds[laneIndex] = group.periodEnd;
    }

    return {
      ...group,
      laneCount: 0,
      laneIndex,
    };
  });

  return placements.map((placement) => ({
    ...placement,
    laneCount: lanePeriodEnds.length,
  }));
}

export function buildTimetableSlotPlacements<TItem extends AcademicTimetableGridItem>(
  items: TItem[],
  getTieBreaker: (item: TItem) => string,
): TimetableSlotPlacement<TItem>[] {
  const groupedItems = groupTimetableItems(items, getTieBreaker);
  const dayGroups = new Map<number, TimetableSlotGroup<TItem>[]>();

  for (const group of groupedItems) {
    const groups = dayGroups.get(group.dayOfWeek);

    if (groups) {
      groups.push(group);
      continue;
    }

    dayGroups.set(group.dayOfWeek, [group]);
  }

  const placements: TimetableSlotPlacement<TItem>[] = [];

  for (const groups of dayGroups.values()) {
    let overlapCluster: TimetableSlotGroup<TItem>[] = [];
    let clusterPeriodEnd = Number.NEGATIVE_INFINITY;

    for (const group of groups) {
      if (overlapCluster.length === 0 || group.periodStart <= clusterPeriodEnd) {
        overlapCluster.push(group);
        clusterPeriodEnd = Math.max(clusterPeriodEnd, group.periodEnd);
        continue;
      }

      placements.push(...buildClusterSlotPlacements(overlapCluster));
      overlapCluster = [group];
      clusterPeriodEnd = group.periodEnd;
    }

    if (overlapCluster.length > 0) {
      placements.push(...buildClusterSlotPlacements(overlapCluster));
    }
  }

  return placements;
}

export function resolveTimetablePeriodCount<TItem extends AcademicTimetableGridItem>(
  items: TItem[],
) {
  const maxPeriodEnd = items.reduce((currentMax, item) => Math.max(currentMax, item.periodEnd), 1);

  return Math.min(MAX_TIMETABLE_PERIOD_COUNT, maxPeriodEnd);
}

export function resolveCurrentTeachingWeekIndex(
  semester: TeachingWeekSemester,
  options: { today?: Date } = {},
) {
  const semesterStart = parseIsoDateOnly(semester.startDate);
  const semesterEnd = parseIsoDateOnly(semester.endDate);
  const firstTeachingDate = parseIsoDateOnly(semester.firstTeachingDate);

  if (!semesterStart || !semesterEnd || !firstTeachingDate) {
    return null;
  }

  const today = normalizeDateOnly(options.today ?? new Date());

  if (today < semesterStart || today > semesterEnd) {
    return null;
  }

  const firstTeachingWeekStart = startOfTeachingWeek(firstTeachingDate);

  if (today < firstTeachingWeekStart) {
    return 1;
  }

  return (
    Math.floor(
      (startOfTeachingWeek(today).getTime() - firstTeachingWeekStart.getTime()) /
        MILLISECONDS_PER_WEEK,
    ) + 1
  );
}

export function resolveTeachingWeekCount(semester: TeachingWeekCountSemester) {
  const firstTeachingDate = parseIsoDateOnly(semester.firstTeachingDate);
  const examStartDate = parseIsoDateOnly(semester.examStartDate);

  if (!firstTeachingDate || !examStartDate) {
    return null;
  }

  const firstTeachingWeekStart = startOfTeachingWeek(firstTeachingDate);
  const examWeekStart = startOfTeachingWeek(examStartDate);
  const lastTeachingWeekStart =
    examWeekStart.getTime() > firstTeachingWeekStart.getTime()
      ? addUtcDays(examWeekStart, -7)
      : firstTeachingWeekStart;

  return (
    Math.floor(
      (lastTeachingWeekStart.getTime() - firstTeachingWeekStart.getTime()) / MILLISECONDS_PER_WEEK,
    ) + 1
  );
}

export function resolveTeachingWeekDateRange(
  semester: TeachingWeekSemester,
  weekIndex: number | null | undefined,
): TeachingWeekDateRange | null {
  if (!weekIndex || weekIndex < 1) {
    return null;
  }

  const firstTeachingDate = parseIsoDateOnly(semester.firstTeachingDate);

  if (!firstTeachingDate) {
    return null;
  }

  const weekStartDate = addUtcDays(startOfTeachingWeek(firstTeachingDate), (weekIndex - 1) * 7);
  const weekEndDate = addUtcDays(weekStartDate, 6);

  return {
    endDate: formatUtcDateOnly(weekEndDate),
    startDate: formatUtcDateOnly(weekStartDate),
  };
}

export function resolveCourseCategoryMeta(courseCategory: string | null | undefined) {
  const normalizedCourseCategory = courseCategory?.trim();

  if (!normalizedCourseCategory) {
    return null;
  }

  return (
    COURSE_CATEGORY_META[normalizedCourseCategory as keyof typeof COURSE_CATEGORY_META] ?? null
  );
}

export function buildAcademicTeachingClassOptionLabel(
  option: AcademicTeachingClassOptionLabelInput,
) {
  const courseText = option.courseNames.length ? option.courseNames.join('/') : '未命名课程';
  const classText = option.teachingClassNames.length
    ? option.teachingClassNames.join('/')
    : '未命名教学班';
  const staffText = option.staffNames.join('/');

  return `${courseText} / ${classText} (${option.sstsTeachingClassId})${
    staffText ? ` - ${staffText}` : ''
  }`;
}
