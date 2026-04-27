import type { AcademicTimetableGridItem } from './api';

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

export function resolveCourseCategoryMeta(courseCategory: string | null | undefined) {
  const normalizedCourseCategory = courseCategory?.trim();

  if (!normalizedCourseCategory) {
    return null;
  }

  return (
    COURSE_CATEGORY_META[normalizedCourseCategory as keyof typeof COURSE_CATEGORY_META] ?? null
  );
}
