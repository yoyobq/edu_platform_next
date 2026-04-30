import { isFutureTeachingDate } from './teaching-date';

export type ResultViewScope = 'complete' | 'missing' | 'unmatched';
export type CourseCategoryFilter = 'ALL' | '1' | '2' | '3';
export type FutureCourseVisibility = 'hide' | 'show';

export type ResultViewScopeOption = {
  count: number;
  label: string;
  value: ResultViewScope;
};

export type CourseCategoryFilterOption = {
  count: number;
  key: CourseCategoryFilter;
  label: string;
};

const COURSE_CATEGORY_FILTER_ORDER = ['1', '2', '3'] as const;
const COURSE_CATEGORY_FILTER_LABELS: Record<(typeof COURSE_CATEGORY_FILTER_ORDER)[number], string> =
  {
    '1': '理论课',
    '2': '实训课',
    '3': '一体化',
  };

export function resolveResultViewScopeLabel(scope: ResultViewScope) {
  if (scope === 'missing') {
    return '待补日志';
  }

  if (scope === 'unmatched') {
    return '需核对';
  }

  return '全部';
}

export function resolveResultViewScopeTitle(scope: ResultViewScope) {
  if (scope === 'missing') {
    return '待补日志的课次';
  }

  if (scope === 'unmatched') {
    return '需要人工核对的课次';
  }

  return '全部课次';
}

export function filterItemsByFutureCourseVisibility<T extends { teachingDate: string | null }>(
  items: T[],
  visibility: FutureCourseVisibility,
) {
  if (visibility === 'show') {
    return items;
  }

  return items.filter((item) => !isFutureTeachingDate(item.teachingDate));
}

export function buildResultViewScopeOptions(counts: {
  complete: number;
  missing: number;
  unmatched: number;
}): ResultViewScopeOption[] {
  return [
    {
      count: counts.complete,
      label: resolveResultViewScopeLabel('complete'),
      value: 'complete' as const,
    },
    {
      count: counts.missing,
      label: resolveResultViewScopeLabel('missing'),
      value: 'missing' as const,
    },
    {
      count: counts.unmatched,
      label: resolveResultViewScopeLabel('unmatched'),
      value: 'unmatched' as const,
    },
  ].filter((option) => option.count > 0);
}

export function resolveResultViewScope(
  options: ResultViewScopeOption[],
  activeScope: ResultViewScope,
) {
  if (options.some((option) => option.value === activeScope)) {
    return activeScope;
  }

  if (options.some((option) => option.value === 'missing')) {
    return 'missing';
  }

  return 'complete';
}

export function pickJournalItemsByResultViewScope<T>(params: {
  editableItems: T[];
  presentedMissingEditableItems: T[];
  resultViewScope: ResultViewScope;
  unmatchedEditableItems: T[];
}) {
  if (params.resultViewScope === 'missing') {
    return params.presentedMissingEditableItems;
  }

  if (params.resultViewScope === 'unmatched') {
    return params.unmatchedEditableItems;
  }

  return params.editableItems;
}

export function buildCourseCategoryFilterOptions<T extends { courseCategory: string | null }>(
  items: T[],
): CourseCategoryFilterOption[] {
  const nonEmptyOptions = COURSE_CATEGORY_FILTER_ORDER.map((courseCategory) => ({
    count: items.filter((item) => item.courseCategory === courseCategory).length,
    key: courseCategory as CourseCategoryFilter,
    label: COURSE_CATEGORY_FILTER_LABELS[courseCategory],
  })).filter((option) => option.count > 0);

  if (nonEmptyOptions.length <= 1) {
    return nonEmptyOptions;
  }

  return [
    {
      count: items.length,
      key: 'ALL' as const,
      label: '所有类型',
    },
    ...nonEmptyOptions,
  ];
}

export function resolveCourseCategoryFilter(
  options: Array<{ key: CourseCategoryFilter }>,
  activeCourseCategory: CourseCategoryFilter,
) {
  if (options.length <= 1) {
    return 'ALL';
  }

  if (options.some((option) => option.key === activeCourseCategory)) {
    return activeCourseCategory;
  }

  return 'ALL';
}

export function filterItemsByCourseCategory<T extends { courseCategory: string | null }>(
  items: T[],
  courseCategory: CourseCategoryFilter,
) {
  if (courseCategory === 'ALL') {
    return items;
  }

  return items.filter((item) => item.courseCategory === courseCategory);
}
